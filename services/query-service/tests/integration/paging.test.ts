import { describe, expect, it } from "vitest";
import { createQueryService } from "../../src/index.js";
import { docs, grant, hit, pagedIndex, registryOf, req, pagedRig as rig } from "../fakes.js";

describe("paging past hidden hits", () => {
  it("pages until limit visible hits are collected", async () => {
    const { service, index, ids } = rig(400, 250);
    const out = await service.searchLive(req(5));
    expect(out.pointers.map((p) => p.id)).toEqual(ids.slice(250, 255));
    expect(out.truncated).toBe(false);
    expect(index.calls).toEqual([0, 100, 200].map((offset) => ({ offset, limit: 100 })));
    expect(service.search(req(5))).toHaveLength(5);
  });

  it("stops without truncation when the index is exhausted", async () => {
    const { service } = rig(30, 30);
    expect(await service.searchLive(req())).toMatchObject({ pointers: [], truncated: false, scanned: 30 });
  });

  it("handles an empty index with one call", async () => {
    const { service, index } = rig(0, 0);
    expect(await service.searchLive(req())).toMatchObject({ pointers: [], truncated: false, scanned: 0 });
    expect(index.calls).toHaveLength(1);
  });

  it("reports truncated when the default 1000 cap stops it", async () => {
    const { service, index } = rig(5000, 5000);
    const out = await service.searchLive(req());
    expect(out).toMatchObject({ pointers: [], truncated: true, scanned: 1000 });
    expect(index.calls).toHaveLength(10);
  });

  it("honours a custom cap and shrinks the last page to fit it", async () => {
    const { service, index } = rig(5000, 5000, { maxCandidates: 250 });
    expect((await service.searchLive(req())).truncated).toBe(true);
    expect(index.calls.map((c) => c.limit)).toEqual([100, 100, 50]);
  });

  it("finds a visible hit at the very last candidate without truncation", async () => {
    const { service } = rig(1000, 999);
    expect(await service.searchLive(req(1))).toMatchObject({ truncated: false, scanned: 1000 });
  });

  it("returns an exactly filled page even when the cap is reached with it", async () => {
    const { service } = rig(5000, 995);
    const out = await service.searchLive(req(5));
    expect(out.pointers).toHaveLength(5);
    expect(out.truncated).toBe(false);
  });

  it("dedupes documents repeated across chunks and pages", async () => {
    const ids = docs(3);
    const hits = [...ids, ...ids, ...ids].map((d, i) => hit(d, i));
    const registry = registryOf(grant(ids, "alice"));
    const service = createQueryService({ index: pagedIndex(hits), registry });
    expect(service.search(req()).map((p) => p.id)).toEqual(ids);
  });

  it("terminates when the index ignores offset (today's index)", async () => {
    const { service, index } = rig(150, 60, {}, { ignoreOffset: true });
    expect((await service.searchLive(req(100))).pointers).toHaveLength(40);
    expect(index.calls).toHaveLength(2);
  });

  it("keeps paging when a full page repeats only already-seen documents", async () => {
    const hits = [...Array.from({ length: 100 }, (_, i) => hit("d0000", i)), hit("d0001")];
    const service = createQueryService({ index: pagedIndex(hits), registry: registryOf(grant(["d0000", "d0001"], "alice")) });
    expect(service.search(req()).map((p) => p.id)).toEqual(["d0000", "d0001"]);
  });
});
