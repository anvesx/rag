import { describe, expect, it } from "vitest";
import { createQueryService, type LiveAcl } from "../../src/index.js";
import { docs, grant, hit, pagedIndex, registryOf } from "../fakes.js";
import { alice, req, liveRig as rig, verdicts } from "../live-fakes.js";

describe("live ACL in the search flow", () => {
  it("asks only about hits that passed the cached filter, with tenant and principal", async () => {
    const seen: unknown[][] = [];
    const { service } = rig(async (...args) => {
      seen.push(args);
      return new Map();
    });
    await service.searchLive(req());
    expect(seen.map((args) => args.slice(0, 3))).toEqual([["t1", docs(5), alice]]);
  });

  it("keeps paging past live-denied hits to fill the limit", async () => {
    const ids = docs(250);
    const index = pagedIndex(ids.map((d) => hit(d)));
    const liveAcl: LiveAcl = async (_t, batch) => new Map(batch.map((id) => [id, id < "d0200" ? "deny" : "allow"] as const));
    const service = createQueryService({ index, registry: registryOf(grant(ids, "alice")), liveAcl });
    const out = await service.searchLive(req(3));
    expect(out.pointers.map((p) => p.id)).toEqual(["d0200", "d0201", "d0202"]);
    expect(out.liveDenied).toBe(200);
  });

  it("refuses the sync search when a verifier is configured (never fail open)", () => {
    const { service } = rig(verdicts({}));
    expect(() => service.search(req())).toThrowError(expect.objectContaining({ code: "LIVE_ACL" }));
  });

  it("isolates concurrent searches with different verdicts", async () => {
    const liveAcl: LiveAcl = async (_t, batch, p) => new Map(batch.map((id) => [id, p.id === "alice" ? "allow" : "deny"] as const));
    const ids = docs(4);
    const registry = registryOf(Object.fromEntries(ids.map((id) => [id, ["alice", "bob"]])));
    const service = createQueryService({ index: pagedIndex(ids.map((d) => hit(d))), registry, liveAcl });
    const bob = { id: "bob", tenantId: "t1", groups: [] };
    const [a, b] = await Promise.all([service.searchLive(req(10)), service.searchLive(req(10, bob))]);
    expect([a.pointers.length, b.pointers.length]).toEqual([4, 0]);
  });
});
