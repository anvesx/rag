import { describe, expect, it } from "vitest";
import { createQueryService, type LiveAcl } from "../../src/index.js";
import { docs, grant, hit, pagedIndex, registryOf } from "../fakes.js";
import { liveRig, manualTimer, req } from "../live-fakes.js";

function many(liveAcl: LiveAcl, timer = manualTimer(), total = 250) {
  const ids = docs(total);
  const index = pagedIndex(ids.map((d) => hit(d)));
  const service = createQueryService({ index, registry: registryOf(grant(ids, "alice")), liveAcl, timer, liveAclTimeoutMs: 50 });
  return { index, service, timer };
}

describe("one deadline for the whole search", () => {
  it("arms a single timer across all pages and clears it at the end", async () => {
    let armed = 0;
    const timer = manualTimer();
    const counting = {
      ...timer,
      set: (fn: () => void) => {
        armed++;
        return timer.set(fn);
      },
    };
    const deny: LiveAcl = async (_t, batch) => new Map(batch.map((id) => [id, "deny" as const]));
    const r = many(deny, counting as never);
    const out = await r.service.searchLive(req(10));
    expect(r.index.calls.length).toBeGreaterThan(1);
    expect(armed).toBe(1);
    expect(out.liveDenied).toBe(250);
    expect(timer.pending.size).toBe(0);
  });

  it("aborts the verifier's signal when the deadline fires and never calls it again", async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const r = many((_t, _b, _p, signal) => {
      signals.push(signal);
      return new Promise<never>(() => undefined);
    });
    const run = r.service.searchLive(req(10));
    await Promise.resolve();
    r.timer.fire();
    const out = await run;
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(out).toMatchObject({ pointers: [], liveUnverified: 10 });
  });
});

describe("paging stops when a step yields no verdicts", () => {
  it("does not fetch a second page after a verifier outage", async () => {
    const r = many(async () => {
      throw new Error("down");
    });
    const out = await r.service.searchLive(req(10));
    expect(r.index.calls).toHaveLength(1);
    expect(out).toMatchObject({ pointers: [], truncated: true, liveUnverified: 10 });
  });
});

describe("verifies only what is still needed", () => {
  it("checks at most the missing number of hits per step and continues past denials", async () => {
    const checked: string[][] = [];
    const { service, ids } = liveRig(async (_t, batch) => {
      checked.push(batch);
      return new Map(batch.map((id) => [id, id === "d0000" || id === "d0001" ? ("deny" as const) : ("allow" as const)]));
    }, 8);
    const out = await service.searchLive(req(2));
    expect(out.pointers.map((p) => p.id)).toEqual([ids[2], ids[3]]);
    expect(checked.map((b) => b.length)).toEqual([2, 2]);
    expect(out).toMatchObject({ liveDenied: 2, liveUnverified: 0 });
  });
});

describe("maxCandidates versus the index window", () => {
  it("rejects values above the hybrid-search window with CONFIG and accepts the window itself", () => {
    const deps = { index: pagedIndex([]), registry: registryOf({}) };
    expect(() => createQueryService({ ...deps, maxCandidates: 1001 })).toThrow(expect.objectContaining({ code: "CONFIG" }));
    expect(() => createQueryService({ ...deps, maxCandidates: 1000 })).not.toThrow();
  });
});
