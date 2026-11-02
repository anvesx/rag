import { describe, expect, it } from "vitest";
import { req, liveRig as rig, verdicts } from "../live-fakes.js";

describe("live ACL verdicts", () => {
  it("behaves exactly like the cached path without a verifier", async () => {
    const { service, ids } = rig();
    const out = await service.searchLive(req());
    expect(out.pointers.map((p) => p.id)).toEqual(ids.slice(0, 5));
    expect(out).toMatchObject({ liveDenied: 0, liveUnverified: 0, truncated: false });
  });

  it("drops denied hits, keeps allowed, fails closed on unknown or missing", async () => {
    const { service, ids } = rig(verdicts({ d0000: "allow", d0001: "deny", d0002: "unknown", d0003: "allow" }));
    const out = await service.searchLive(req());
    expect(out.pointers.map((p) => p.id)).toEqual([ids[0], ids[3]]);
    expect(out).toMatchObject({ liveDenied: 1, liveUnverified: 2 });
  });

  it("does not call the verifier when nothing passed the cached filter", async () => {
    let calls = 0;
    const { service } = rig(async () => {
      calls++;
      return new Map();
    });
    await service.searchLive(req(10, { id: "nobody", tenantId: "t1", groups: [] }));
    expect(calls).toBe(0);
  });

  it("fails closed when the verifier throws, counting every dropped hit", async () => {
    const { service } = rig(async () => {
      throw new Error("source down");
    });
    expect(await service.searchLive(req())).toMatchObject({ pointers: [], liveUnverified: 5, liveDenied: 0 });
  });

  it("fails closed when the verifier hangs past the timeout and clears the timer otherwise", async () => {
    const hung = rig(() => new Promise(() => undefined));
    const run = hung.service.searchLive(req());
    await Promise.resolve();
    hung.timer.fire();
    expect(await run).toMatchObject({ pointers: [], liveUnverified: 5 });
    const ok = rig(verdicts({ d0000: "allow" }));
    await ok.service.searchLive(req());
    expect(ok.timer.pending.size).toBe(0);
  });

  it("treats a malformed verifier result as unknown", async () => {
    const { service } = rig((async () => ({ d0000: "allow" })) as never);
    expect(await service.searchLive(req())).toMatchObject({ pointers: [], liveUnverified: 5 });
  });
});
