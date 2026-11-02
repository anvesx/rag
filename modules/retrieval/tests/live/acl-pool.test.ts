import { describe, expect, it } from "vitest";
import { alice, build, ok } from "./support.js";

describe("live acl pool", () => {
  it("caps concurrent fetches at 8 by default and at the configured value", async () => {
    for (const [concurrency, expected] of [
      [undefined, 8],
      [2, 2],
    ] as const) {
      let live = 0;
      let peak = 0;
      const verify = build(
        async () => {
          peak = Math.max(peak, ++live);
          await new Promise((r) => setTimeout(r, 5));
          live--;
          return { text: "x", version: "1" };
        },
        true,
        concurrency,
      );
      const out = await verify(
        "t1",
        Array.from({ length: 30 }, (_, i) => `d${i}`),
        alice,
      );
      expect([...out.values()].every((v) => v === "allow")).toBe(true);
      expect(peak).toBe(expected);
    }
  });

  it("rejects a non-positive or fractional concurrency at construction", () => {
    for (const bad of [0, -1, 1.5]) expect(() => build(ok, true, bad)).toThrow(expect.objectContaining({ code: "CONFIG" }));
  });

  it("passes its signal to fetch and starts no fetch once aborted", async () => {
    const seen: Array<AbortSignal | undefined> = [];
    const controller = new AbortController();
    const verify = build(
      async (_a, ctx) => {
        seen.push(ctx.signal);
        controller.abort();
        return { text: "x", version: "1" };
      },
      true,
      1,
    );
    const out = await verify("t1", ["a", "b", "c"], alice, controller.signal);
    expect(seen).toEqual([controller.signal]);
    expect(out).toEqual(
      new Map([
        ["a", "allow"],
        ["b", "unknown"],
        ["c", "unknown"],
      ]),
    );
  });
});
