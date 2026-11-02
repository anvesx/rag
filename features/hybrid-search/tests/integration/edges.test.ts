import type { Acl } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex, SearchError } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };
const all = { sql: "1", params: [] };
const row = (chunkId: string, over: object = {}) => ({ chunkId, docId: "d", tenantId: "t", text: "x", embedding: [1, 0], acl, ...over });
const bad = (code: string) => new SearchError(code as "INPUT");

describe("input edges", () => {
  it("bounds identifier length at 256", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(row("a".repeat(256)));
    expect(() => index.add(row("a".repeat(257)))).toThrowError(bad("INPUT"));
    expect(() => index.add(row("b", { docId: "" }))).toThrowError(bad("INPUT"));
    expect(() => index.add(row("b", { tenantId: "" }))).toThrowError(bad("INPUT"));
    expect(() => index.add(row("b", { text: 5 }))).toThrowError(bad("INPUT"));
    expect(index.add(row("c", { text: "" }))).toBeUndefined();
  });

  it("accepts dim 1 and 4096 but rejects 4097 and fractions", () => {
    expect(createSearchIndex(":memory:", 1)).toBeDefined();
    expect(createSearchIndex(":memory:", 4096)).toBeDefined();
    for (const dim of [4097, 1.5, -2]) expect(() => createSearchIndex(":memory:", dim)).toThrowError(bad("DIM"));
  });

  it("survives null and malformed arguments with typed errors", () => {
    const index = createSearchIndex(":memory:", 2);
    const q = { text: "", embedding: [1, 0], limit: 1, acl: all };
    expect(() => index.add(null as never)).toThrowError(bad("DIM"));
    expect(() => index.add(row(null as never))).toThrowError(bad("INPUT"));
    expect(() => index.search(null as never)).toThrowError(bad("DIM"));
    expect(() => index.search({ ...q, limit: null as never })).toThrowError(bad("LIMIT"));
    expect(() => index.search({ ...q, text: 3 as never })).toThrowError(bad("INPUT"));
    expect(() => index.search({ ...q, acl: null as never })).toThrowError(bad("INPUT"));
    expect(() => index.search({ ...q, acl: { sql: "1", params: "x" as never } })).toThrowError(bad("ACL"));
  });

  it("maps storage failures to DB", () => {
    const index = createSearchIndex(":memory:", 2);
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => index.add(row("z", { acl: loop }))).toThrowError(bad("DB"));
    index.add(row("ok"));
  });

  it("binds null, number, bigint and blob ACL params", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(row("a"));
    const sql = "(? IS NULL) AND ? = 1 AND ? = 1 AND length(?) = 1";
    const params = [null, 1, 1n, new Uint8Array([1])];
    const hits = index.search({ text: "", embedding: [1, 0], limit: 1, acl: { sql, params } });
    expect(hits).toHaveLength(1);
    expect(() => index.search({ text: "", embedding: [1, 0], limit: 1, acl: { sql, params: [true] } })).toThrowError(bad("ACL"));
  });

  it("treats tabs and newlines as token separators and quotes literally", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add(row("a", { text: "alpha beta" }));
    const hits = index.search({ text: "alpha\nbeta", embedding: [0, 1], limit: 1, acl: all });
    expect(hits[0]?.score).toBeCloseTo(1 / 61 + 1 / 61);
    index.add(row("b", { docId: "e", text: "a b" }));
    expect(index.search({ text: '"', embedding: [0, 1], limit: 5, acl: all })).toBeDefined();
  });
});
