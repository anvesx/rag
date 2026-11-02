import { describe, expect, it } from "vitest";
import { five, setup, withSink } from "../helpers.js";

describe("tenant isolation", () => {
  it("each tenant gets every event and its own cursor", async () => {
    const { runtime, events, cursors } = setup(five);
    await runtime.runOnce("t1");
    expect(cursors.getCursor("t2", "fake")).toBeUndefined();
    await runtime.runOnce("t2");
    expect(events.filter((e) => e.tenantId === "t1")).toHaveLength(5);
    expect(events.filter((e) => e.tenantId === "t2")).toHaveLength(5);
  });

  it("one tenant's sink failure does not disturb another's progress", async () => {
    const s = setup(five);
    const delivered: string[] = [];
    const rt = withSink(s, (e) => {
      if (e.tenantId === "t1" && e.address === "b") throw new Error("t1 down");
      delivered.push(`${e.tenantId}:${e.address}`);
    });
    expect((await rt.runOnce("t1")).failures).toHaveLength(1);
    await rt.runOnce("t2");
    expect(delivered.filter((d) => d.startsWith("t2:"))).toHaveLength(5);
    expect(s.cursors.getCursor("t2", "fake")).toBe("");
  });
});
