import { describe, expect, it } from "vitest";
import { createConnectorRuntime, RuntimeError } from "../../src/index.js";
import { doc, five, setup } from "../helpers.js";

describe("runOnce", () => {
  it("first run emits all across pages, second run emits none", async () => {
    const { runtime, events } = setup(five);
    expect(await runtime.runOnce("t1")).toMatchObject({ emitted: 5, skipped: 0 });
    expect(events.map((e) => e.address)).toEqual(["a", "b", "c", "d", "e"]);
    expect(await runtime.runOnce("t1")).toMatchObject({ emitted: 0, skipped: 5 });
    expect(events).toHaveLength(5);
  });

  it("event carries tenant, connector, version and clock time", async () => {
    const { runtime, events } = setup([doc("a", "v9")]);
    await runtime.runOnce("t1");
    expect(events[0]).toMatchObject({
      tenantId: "t1",
      connectorId: "fake",
      address: "a",
      version: "v9",
      emittedAt: 1000,
    });
  });

  it("empty connector emits nothing", async () => {
    const { runtime } = setup([]);
    expect(await runtime.runOnce("t1")).toMatchObject({ emitted: 0, skipped: 0 });
  });

  it("rejects an empty tenant id with a typed error", async () => {
    const { runtime } = setup([]);
    await expect(runtime.runOnce("")).rejects.toMatchObject({
      name: "RuntimeError",
      code: "INVALID_INPUT",
    });
  });

  it("rejects a bad page size", () => {
    const s = setup([]);
    expect(() => createConnectorRuntime({ ...s, clock: () => 1, pageSize: 0 })).toThrow(RuntimeError);
    expect(() => createConnectorRuntime({ ...s, clock: () => 1, pageSize: 1001 })).toThrow(RuntimeError);
  });

  it("accepts boundary option values and names the bad option in the error", () => {
    const s = setup([]);
    const make = (o: object) => createConnectorRuntime({ ...s, clock: () => 1, ...o });
    for (const o of [{ pageSize: 1 }, { pageSize: 1000 }, { maxAttempts: 1 }, { maxAttempts: 20 }]) {
      expect(() => make(o)).not.toThrow();
    }
    expect(() => make({ pageSize: 0 })).toThrow("pageSize must be an integer in 1-1000");
    expect(() => make({ maxAttempts: 21 })).toThrow("maxAttempts must be an integer in 1-20");
    expect(() => make({ maxAttempts: 1.5 })).toThrow(/maxAttempts/);
  });

  it("rejects non-string tenant ids with a message", async () => {
    const { runtime } = setup([]);
    for (const bad of [undefined, 5]) {
      await expect(runtime.runOnce(bad as unknown as string)).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: "tenantId must be a non-empty string",
      });
    }
  });

  it("handles unicode addresses", async () => {
    const { runtime, events } = setup([doc("日本語/ファイル🙂.md")]);
    await runtime.runOnce("t1");
    expect(events[0]?.address).toBe("日本語/ファイル🙂.md");
  });
});
