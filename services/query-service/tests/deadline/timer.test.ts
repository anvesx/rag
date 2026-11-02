import { afterEach, describe, expect, it, vi } from "vitest";
import { req, pagedRig as rig } from "../fakes.js";

afterEach(() => vi.useRealTimers());

describe("real deadline timer", () => {
  it("fails closed with the real timer when the verifier hangs", async () => {
    vi.useFakeTimers();
    const { service } = rig(2, 0, { liveAcl: () => new Promise(() => undefined), liveAclTimeoutMs: 30 });
    const run = service.searchLive(req());
    await vi.advanceTimersByTimeAsync(30);
    expect(await run).toMatchObject({ pointers: [], liveUnverified: 2 });
  });
});

describe("search deadline timer", () => {
  it("sets one timer for the configured delay and clears that handle exactly once", async () => {
    const set = vi.fn((_fn: () => void, _ms: number): unknown => "h1");
    const clear = vi.fn();
    const { service } = rig(2, 0, { liveAcl: async () => new Map([["d0000", "allow" as const]]), liveAclTimeoutMs: 30, timer: { set, clear } });
    await service.searchLive(req());
    expect(set).toHaveBeenCalledWith(expect.any(Function), 30);
    expect(clear.mock.calls).toEqual([["h1"]]);
  });

  it("does not call clear when the timer handed back no handle", async () => {
    const clear = vi.fn();
    const { service } = rig(2, 0, { liveAcl: async () => new Map(), timer: { set: () => undefined, clear } });
    await service.searchLive(req());
    expect(clear).not.toHaveBeenCalled();
  });
});
