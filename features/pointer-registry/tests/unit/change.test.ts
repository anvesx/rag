import type { Pointer } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { ptr } from "../fixtures.js";

describe("change detection", () => {
  it("created, unchanged, then updated on each tracked field", () => {
    const r = createRegistry(":memory:");
    expect(r.upsert(ptr()).change).toBe("created");
    expect(r.upsert(ptr()).change).toBe("unchanged");
    expect(r.upsert(ptr({ contentHash: "b".repeat(64) })).change).toBe("updated");
    expect(r.upsert(ptr({ contentHash: "b".repeat(64) })).change).toBe("unchanged");
    expect(r.upsert(ptr({ contentHash: "b".repeat(64), version: "v2" })).change).toBe("updated");
    const acl = { allowUsers: [], allowGroups: [], version: 2 };
    expect(r.upsert(ptr({ contentHash: "b".repeat(64), version: "v2", acl })).change).toBe("updated");
  });
  it("unchanged does not write: a differing field is never ignored, a timestamp-only bump is", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr({ title: "old" }));
    const res = r.upsert(ptr({ title: "new" }));
    expect(res.change).toBe("updated");
    expect(r.get("t1", "doc-1")?.title).toBe("new");
    const same = r.upsert(ptr({ title: "new", updatedAt: "2026-12-01T00:00:00Z" }));
    expect(same.change).toBe("unchanged");
    expect(same.pointer.updatedAt).toBe("2026-11-01T00:00:00Z");
  });
  const acl = (allowUsers: string[], allowGroups: string[], version = 1) => ({ allowUsers, allowGroups, version });
  it.each<[string, Partial<Pointer>]>([
    ["zone", { zone: "personal" }],
    ["address", { address: "x://moved" }],
    ["source", { source: "notion" }],
    ["title", { title: "Renamed" }],
    ["acl user removed, version not bumped", { acl: acl([], []) }],
    ["acl user added, version not bumped", { acl: acl(["u1", "u2"], []) }],
    ["acl group added, version not bumped", { acl: acl(["u1"], ["g1"]) }],
  ])("%s changed alone is updated and persisted", (_name, over) => {
    const r = createRegistry(":memory:");
    r.upsert(ptr());
    const next = ptr(over);
    const res = r.upsert(next);
    expect(res.change).toBe("updated");
    expect(res.pointer).toEqual(next);
    expect(r.get("t1", "doc-1")).toEqual(next);
  });
  it("acl lists compare as sets: reordering is unchanged, nothing written", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr({ acl: acl(["a", "b"], ["x", "y"]) }));
    const res = r.upsert(ptr({ acl: acl(["b", "a"], ["y", "x"]) }));
    expect(res.change).toBe("unchanged");
    expect(res.pointer.acl.allowUsers).toEqual(["a", "b"]);
  });
  it("updated writes every field", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr());
    const next = ptr({
      version: "v2",
      title: "T2",
      address: "x://2",
      zone: "company",
      source: "s2",
      acl: { allowUsers: ["a", "b"], allowGroups: ["g"], version: 5 },
      updatedAt: "2026-11-02T00:00:00Z",
    });
    expect(r.upsert(next).pointer).toEqual(next);
    expect(r.get("t1", "doc-1")).toEqual(next);
  });
  it("returns created pointer with defaults applied", () => {
    const r = createRegistry(":memory:");
    const { title: _t, deletedAt: _d, ...raw } = ptr();
    const out = r.upsert(raw as never).pointer;
    expect(out.title).toBe("");
    expect(out.deletedAt).toBeNull();
  });
});
