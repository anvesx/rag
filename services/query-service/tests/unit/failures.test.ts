import { describe, expect, it } from "vitest";
import { QueryError } from "../../src/index.js";
import { req, pagedRig as rig } from "../fakes.js";

describe("failures and bounds", () => {
  it("maps a later-page index failure to BACKEND", () => {
    const { service } = rig(300, 150, {}, { failAt: 100 });
    expect(() => service.search(req(5))).toThrowError(expect.objectContaining({ code: "BACKEND" }));
  });

  it("maps a registry failure mid-scan to BACKEND", () => {
    const { service, registry } = rig(300, 0);
    registry.get = () => {
      throw new Error("db gone");
    };
    expect(() => service.search(req())).toThrowError(expect.objectContaining({ code: "BACKEND" }));
  });

  it.each([-5, 0, 101])("rejects limit %s before touching the index", (limit) => {
    const { service, index } = rig(10, 0);
    expect(() => service.search(req(limit))).toThrowError(expect.objectContaining({ code: "LIMIT" }));
    expect(index.calls).toHaveLength(0);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects maxCandidates %s", (maxCandidates) => {
    const make = () => rig(1, 0, { maxCandidates });
    expect(make).toThrowError(QueryError);
    expect(make).toThrowError(expect.objectContaining({ code: "CONFIG" }));
  });

  it("accepts maxCandidates 1 and reports truncation after one hit", async () => {
    const { service, index } = rig(5, 5, { maxCandidates: 1 });
    expect(await service.searchLive(req())).toMatchObject({ truncated: true, scanned: 1 });
    expect(index.calls).toEqual([{ offset: 0, limit: 1 }]);
  });

  it("serves concurrent searches independently", async () => {
    const { service, ids } = rig(300, 120);
    const runs = await Promise.all(Array.from({ length: 25 }, (_, i) => service.searchLive(req(1 + (i % 7)))));
    for (const [i, out] of runs.entries()) expect(out.pointers.map((p) => p.id)).toEqual(ids.slice(120, 121 + (i % 7)));
  });
});
