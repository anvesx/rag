import type { Principal } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { allowClause } from "../../../acl-filter/src/index.js";
import { createSearchIndex } from "../../src/index.js";

const acl = { allowUsers: ["alice"], allowGroups: ["eng"], version: 1 };
const person = (id: string, tenantId = "t", groups: string[] = []): Principal => ({ id, tenantId, groups });

function build() {
  const index = createSearchIndex(":memory:", 2);
  index.add({ chunkId: "c1", docId: "d1", tenantId: "t", text: "needle", embedding: [1, 0], acl });
  return (p: Principal) => index.search({ text: "needle", embedding: [1, 0], limit: 5, acl: allowClause(p) }).map((h) => h.chunkId);
}

describe("allowClause wired into a real index", () => {
  it("denies a tenant member who is not on the ACL, on both retrieval paths", () => {
    const find = build();
    expect(find(person("bob"))).toEqual([]);
    expect(find(person("bob", "t", ["ops"]))).toEqual([]);
  });

  it("allows a listed user and a member of a listed group", () => {
    const find = build();
    expect(find(person("alice"))).toEqual(["c1"]);
    expect(find(person("bob", "t", ["eng"]))).toEqual(["c1"]);
  });

  it("denies a listed user from another tenant", () => {
    expect(build()(person("alice", "other"))).toEqual([]);
  });

  it("updateAcl rewrites every chunk of one document, leaving other docs and tenants alone", () => {
    const index = createSearchIndex(":memory:", 2);
    const add = (chunkId: string, docId: string, tenantId: string) => index.add({ chunkId, docId, tenantId, text: "needle", embedding: [1, 0], acl });
    add("c1", "d1", "t");
    add("c2", "d1", "t");
    add("c3", "d2", "t");
    add("c4", "d1", "other");
    expect(index.updateAcl("d1", "t", { allowUsers: [], allowGroups: [], version: 2 })).toBe(2);
    const find = () => index.search({ text: "needle", embedding: [1, 0], limit: 9, acl: allowClause(person("alice")) }).map((h) => h.chunkId);
    expect(find()).toEqual(["c3"]);
    expect(index.updateAcl("d1", "t", { allowUsers: ["alice"], allowGroups: [], version: 3 })).toBe(2);
    expect(find().sort()).toEqual(["c1", "c2", "c3"]);
    expect(() => index.updateAcl("", "t", acl)).toThrow();
  });
});
