import { describe, expect, it } from "vitest";
import { doc, failingOn, five, setup, withSink } from "../helpers.js";

describe("a permanently failing document", () => {
  it("does not block later documents and is quarantined after three attempts", async () => {
    const s = setup(five);
    const delivered: string[] = [];
    const rt = withSink(
      s,
      failingOn("b", delivered, () => true),
    );
    const first = await rt.runOnce("t1");
    expect(delivered).toEqual(["a", "c", "d", "e"]);
    expect(first).toMatchObject({ emitted: 4, failures: [{ address: "b", error: "boom" }], quarantined: [] });
    expect((await rt.runOnce("t1")).quarantined).toEqual([]);
    const third = await rt.runOnce("t1");
    expect(third.failures).toEqual([{ address: "b", error: "boom" }]);
    expect(third.quarantined).toEqual([{ address: "b", error: "boom" }]);
    expect(s.cursors.getCursor("t1", "fake")).toBe("");
    const fourth = await rt.runOnce("t1");
    expect(fourth).toMatchObject({ emitted: 0, failures: [], quarantined: [{ address: "b", error: "boom" }] });
  });

  it("a new version of a quarantined document is tried again", async () => {
    const s = setup([doc("b")]);
    const rt = withSink(s, () => {
      throw new Error("x");
    });
    for (let i = 0; i < 3; i++) await rt.runOnce("t1");
    expect((await rt.runOnce("t1")).quarantined).toHaveLength(1);
    s.connector.list = async () => ({ items: [doc("b", "v2")] });
    const ok = withSink(s, () => undefined);
    expect(await ok.runOnce("t1")).toMatchObject({ emitted: 1, quarantined: [] });
  });

  it("recovering before the limit resets the count", async () => {
    const s = setup(five);
    let fail = true;
    const rt = withSink(
      s,
      failingOn("b", [], () => fail),
    );
    await rt.runOnce("t1");
    await rt.runOnce("t1");
    fail = false;
    expect((await rt.runOnce("t1")).failures).toEqual([]);
    fail = true;
    expect((await rt.runOnce("t1")).quarantined).toEqual([]);
  });
});

describe("concurrent runs for one tenant", () => {
  it("are serialised, so a failed event is not lost to a racing run", async () => {
    const s = setup(five);
    const delivered: string[] = [];
    let failed = false;
    const rt = withSink(s, async (e) => {
      await new Promise((r) => setTimeout(r, 1));
      if (e.address === "c" && !failed) {
        failed = true;
        throw new Error("once");
      }
      delivered.push(e.address);
    });
    await Promise.all([rt.runOnce("t1"), rt.runOnce("t1")]);
    expect([...delivered].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(s.cursors.getCursor("t1", "fake#inflight") ?? "").toBe("");
  });
});
