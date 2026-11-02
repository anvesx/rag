import { afterEach, describe, expect, it, vi } from "vitest";
import { liveCheck, realTimer } from "../../src/paging/live.js";
import { req, pagedRig as rig } from "../fakes.js";
import { alice } from "../live-fakes.js";

const pointers = [{ id: "d0000" }, { id: "d0001" }] as never;

afterEach(() => vi.useRealTimers());

describe("realTimer", () => {
  it("fires the callback after the delay and not before", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    realTimer.set(fn, 50);
    vi.advanceTimersByTime(49);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clear cancels a pending callback", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    realTimer.clear(realTimer.set(fn, 50));
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("liveCheck signal handling", () => {
  it("never calls the verifier once the signal is aborted", async () => {
    const verify = vi.fn();
    expect(await liveCheck(verify, AbortSignal.abort(), alice, pointers)).toEqual({ allowed: new Set(), denied: 0, unverified: 2 });
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed when the signal aborts while the verifier hangs", async () => {
    const controller = new AbortController();
    const run = liveCheck(() => new Promise(() => undefined), controller.signal, alice, pointers);
    controller.abort();
    expect(await run).toEqual({ allowed: new Set(), denied: 0, unverified: 2 });
  });
});

describe("scan termination", () => {
  it("makes a single index call when the first page is short but non-empty", async () => {
    const { service, index } = rig(30, 30);
    await service.searchLive(req());
    expect(index.calls).toHaveLength(1);
  });

  it("stops at the first repeated full page when the index ignores offset, without truncation", async () => {
    const { service, index } = rig(150, 150, {}, { ignoreOffset: true });
    expect(await service.searchLive(req())).toMatchObject({ pointers: [], truncated: false, scanned: 200 });
    expect(index.calls).toHaveLength(2);
  });
});
