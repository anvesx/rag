import { describe, expect, it } from "vitest";
import { failingOn, five, setup, withSink } from "../helpers.js";

describe("sink failure", () => {
  it("restarts the scan from the first page and retries the item, not losing it", async () => {
    const s = setup(five);
    let fail = true;
    const delivered: string[] = [];
    const rt = withSink(
      s,
      failingOn("c", delivered, () => fail),
    );
    const first = await rt.runOnce("t1");
    expect(first.failures).toEqual([{ address: "c", error: "boom" }]);
    expect(s.cursors.getCursor("t1", "fake")).toBe("");
    expect(delivered).toEqual(["a", "b", "d", "e"]);
    fail = false;
    await rt.runOnce("t1");
    expect(delivered).toEqual(["a", "b", "d", "e", "c"]);
  });

  it("on the first page leaves no cursor", async () => {
    const s = setup(five);
    const rt = withSink(
      s,
      failingOn("a", [], () => true),
    );
    expect((await rt.runOnce("t1")).failures).toHaveLength(1);
    expect(s.cursors.getCursor("t1", "fake") ?? "").toBe("");
  });

  it("async rejection is collected as a failure with its message", async () => {
    const rt = withSink(setup(five), async () => {
      throw new Error("async boom");
    });
    const result = await rt.runOnce("t1");
    expect(result.failures).toHaveLength(5);
    expect(result.failures[0]).toEqual({ address: "a", error: "async boom" });
  });
});
