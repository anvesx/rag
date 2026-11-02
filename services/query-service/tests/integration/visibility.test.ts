import { describe, expect, it } from "vitest";
import { alice, person, rig } from "../harness.js";

describe("visibility matrix over a real index and registry", () => {
  const zones = ["personal", "team", "company"] as const;
  it.each(zones)("%s zone: user entry, group entry, and neither", (zone) => {
    const { seed, ids } = rig();
    seed({ id: `u-${zone}`, zone, users: ["alice"] });
    seed({ id: `g-${zone}`, zone, groups: ["eng"] });
    seed({ id: `n-${zone}`, zone, users: ["carol"], groups: ["ops"] });
    expect(ids(alice).sort()).toEqual([`g-${zone}`, `u-${zone}`]);
    expect(ids(person("bob"))).toEqual([]);
    expect(ids(person("bob", "t1", ["ops"]))).toEqual([`n-${zone}`]);
  });

  it("empty ACL grants nobody", () => {
    const { seed, ids } = rig();
    seed({ id: "d1" });
    expect(ids(alice)).toEqual([]);
  });

  it("isolates tenants in both directions", () => {
    const { seed, ids } = rig();
    seed({ id: "d1", users: ["alice"] });
    seed({ id: "d1", tenantId: "t2", users: ["alice"] });
    expect(ids(alice)).toEqual(["d1"]);
    expect(ids(person("alice", "t2"))).toEqual(["d1"]);
    expect(ids(person("alice", "t3"))).toEqual([]);
  });

  it("returns full pointers, one per document even with several matching chunks", () => {
    const { seed, index, service } = rig();
    const p = seed({ id: "d1", users: ["alice"] });
    index.add({ chunkId: "d1-c2", docId: "d1", tenantId: "t1", text: "needle needle", embedding: [1, 0], acl: p.acl });
    expect(service.search({ query: "needle", principal: alice, embedding: [1, 0] })).toEqual([p]);
  });
});

describe("staleness", () => {
  it("hides a tombstoned document that is still indexed", () => {
    const { seed, registry, ids } = rig();
    seed({ id: "d1", users: ["alice"] });
    seed({ id: "d2", users: ["alice"] });
    registry.tombstone("t1", "d1", "2026-11-02T00:00:00Z");
    expect(ids(alice)).toEqual(["d2"]);
  });

  it("hides a document whose ACL was revoked in the registry after indexing", () => {
    const { seed, registry, ids } = rig();
    const p = seed({ id: "d1", users: ["alice"] });
    expect(ids(alice)).toEqual(["d1"]);
    registry.upsert({ ...p, acl: { allowUsers: [], allowGroups: [], version: 2 } });
    expect(ids(alice)).toEqual([]);
  });

  it("hides an indexed chunk with no registry pointer", () => {
    const { index, ids } = rig();
    const acl = { allowUsers: ["alice"], allowGroups: [], version: 1 };
    index.add({ chunkId: "c", docId: "ghost", tenantId: "t1", text: "needle", embedding: [1, 0], acl });
    expect(ids(alice)).toEqual([]);
  });
});
