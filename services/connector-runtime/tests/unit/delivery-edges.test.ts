import { describe, expect, it } from "vitest";
import { doc, failingOn, five, setup, withSink } from "../helpers.js";

describe("run results", () => {
  it("a clean run reports no failures and no quarantine", async () => {
    const { runtime } = setup(five);
    expect(await runtime.runOnce("t1")).toEqual({ emitted: 5, skipped: 0, restarted: false, failures: [], quarantined: [] });
  });

  it("after a failure the cursor stays at the start for the rest of the scan", async () => {
    const s = setup(five);
    const seen: Array<string | undefined> = [];
    const rt = withSink(s, (e) => {
      seen.push(s.cursors.getCursor("t1", "fake"));
      if (e.address === "a") throw new Error("boom");
    });
    await rt.runOnce("t1");
    expect(seen).toEqual([undefined, "", "", "", ""]);
  });

  it("a quarantined document is skipped (counted, not sent) and leaves nothing pending", async () => {
    const s = setup([doc("b")]);
    const rt = withSink(
      s,
      failingOn("b", [], () => true),
    );
    for (let i = 0; i < 3; i++) await rt.runOnce("t1");
    expect(s.cursors.getCursor("t1", "fake#inflight") ?? "").toBe("");
    const calls: string[] = [];
    const again = withSink(s, (e) => void calls.push(e.address));
    expect(await again.runOnce("t1")).toMatchObject({ emitted: 0, skipped: 1 });
    expect(calls).toEqual([]);
  });

  it("a non-Error rejection is reported as its string form", async () => {
    const s = setup([doc("b")]);
    const rt = withSink(s, () => {
      throw "plain";
    });
    expect((await rt.runOnce("t1")).failures).toEqual([{ address: "b", error: "plain" }]);
  });
});
