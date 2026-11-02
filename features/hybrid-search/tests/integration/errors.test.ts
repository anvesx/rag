import type { Acl } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex, SearchError } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };
const all = { sql: "1", params: [] };
const chunk = (chunkId: string, docId = "d", text = "needle") => ({ chunkId, docId, tenantId: "t", text, embedding: [1, 0], acl });

describe("SearchIndex validation", () => {
  it("accepts limits 1 and 100 and rejects 101 and fractions", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(chunk("a"));
    expect(index.search({ text: "", embedding: [1, 0], limit: 100, acl: all })).toHaveLength(1);
    for (const limit of [101, 1.5, -1, Number.NaN])
      expect(() => index.search({ text: "", embedding: [1, 0], limit, acl: all })).toThrowError(new SearchError("LIMIT"));
  });

  it("rejects duplicate chunk ids without leaving partial rows", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(chunk("a"));
    expect(() => index.add(chunk("a", "other"))).toThrowError(new SearchError("DUPLICATE"));
    expect(index.remove("other", "t")).toBe(0);
    expect(index.search({ text: "needle", embedding: [1, 0], limit: 10, acl: all })).toHaveLength(1);
  });

  it("rejects invalid ACL params, empty ACL sql and bad ids", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(chunk("a"));
    const q = { text: "", embedding: [1, 0], limit: 1 };
    expect(() => index.search({ ...q, acl: { sql: "tenant_id = ?", params: [{}] } })).toThrowError(new SearchError("ACL"));
    expect(() => index.search({ ...q, acl: { sql: " ", params: [] } })).toThrowError(new SearchError("INPUT"));
    expect(() => index.add(chunk(""))).toThrowError(new SearchError("INPUT"));
    expect(() => index.remove("", "t")).toThrowError(new SearchError("INPUT"));
    expect(() => index.add({ ...chunk("b"), embedding: [Number.NaN, 0] })).toThrowError(new SearchError("DIM"));
  });

  it("surfaces SQL errors in search as SearchError DB", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(chunk("a"));
    const q = { text: "needle", embedding: [1, 0], limit: 1, acl: { sql: "no_such_column = ?", params: [1] } };
    expect(() => index.search(q)).toThrowError(new SearchError("DB"));
    expect(() => index.search({ ...q, text: "" })).toThrowError(new SearchError("DB"));
    expect(() => index.remove("d", "")).toThrowError(new SearchError("INPUT"));
  });

  it("rejects bad dimensions at construction", () => {
    expect(() => createSearchIndex(":memory:", 0)).toThrowError(new SearchError("DIM"));
  });
});

describe("SearchIndex behaviour", () => {
  it("never returns a forbidden chunk even when it ranks first everywhere", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ ...chunk("secret"), tenantId: "no" });
    index.add({ ...chunk("ok", "o", "needle other"), tenantId: "ok", embedding: [0, 1] });
    const hits = index.search({ text: "needle", embedding: [1, 0], limit: 5, acl: { sql: "tenant_id = ?", params: ["ok"] } });
    expect(hits.map((h) => h.chunkId)).toEqual(["ok"]);
    expect(hits[0]?.docId).toBe("o");
  });

  it("keeps other documents when one is removed", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(chunk("a", "d1"));
    index.add(chunk("b", "d2"));
    expect(index.remove("d1", "t")).toBe(1);
    const hits = index.search({ text: "needle", embedding: [1, 0], limit: 5, acl: all });
    expect(hits.map((h) => h.chunkId)).toEqual(["b"]);
  });

  it("fuses fts and vector ranks", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ ...chunk("kw", "k", "needle"), embedding: [0, 1] });
    index.add({ ...chunk("vc", "v", "zzz"), embedding: [1, 0] });
    const hits = index.search({ text: "needle", embedding: [1, 0], limit: 5, acl: all });
    expect(hits.map((h) => h.chunkId).sort()).toEqual(["kw", "vc"]);
    expect(hits[0]?.chunkId).toBe("kw");
    expect(hits[0]?.score).toBeCloseTo(1 / 61 + 1 / 62);
  });
});
