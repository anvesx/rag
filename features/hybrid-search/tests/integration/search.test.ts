import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Acl } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex, SearchError } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };
describe("SearchIndex", () => {
  it("applies the opaque ACL before both rankings", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ chunkId: "allowed-a", docId: "a", tenantId: "ok", text: "needle", embedding: [0.7, 0.3], acl });
    index.add({ chunkId: "forbidden", docId: "b", tenantId: "no", text: "needle", embedding: [1, 0], acl });
    index.add({ chunkId: "allowed-c", docId: "c", tenantId: "ok", text: "other", embedding: [0, 1], acl });

    const hits = index.search({ text: "needle", embedding: [1, 0], limit: 3, acl: { sql: "tenant_id = ?", params: ["ok"] } });

    expect(hits.map(({ chunkId }) => chunkId)).toContain("allowed-a");
    expect(hits.map(({ chunkId }) => chunkId)).not.toContain("forbidden");
  });

  it("supports vector-only and empty-result searches", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ chunkId: "one", docId: "doc", tenantId: "ok", text: "text", embedding: [1, 0], acl });
    expect(index.search({ text: "", embedding: [1, 0], limit: 1, acl: { sql: "tenant_id = ?", params: ["ok"] } })).toHaveLength(1);
    expect(index.search({ text: "missing", embedding: [0, 1], limit: 1, acl: { sql: "tenant_id = ?", params: ["none"] } })).toEqual([]);
  });

  it("overfetches until an authorized vector is found", () => {
    const index = createSearchIndex(":memory:", 2);
    for (let i = 0; i < 20; i += 1) index.add({ chunkId: `no-${i}`, docId: `no-${i}`, tenantId: "no", text: "x", embedding: [1, i / 100], acl });
    index.add({ chunkId: "yes", docId: "yes", tenantId: "ok", text: "x", embedding: [0, 1], acl });
    const hits = index.search({ text: "", embedding: [1, 0], limit: 1, acl: { sql: "tenant_id = ?", params: ["ok"] } });
    expect(hits.map(({ chunkId }) => chunkId)).toEqual(["yes"]);
  });

  it("treats FTS quotes, stars and NEAR as text", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ chunkId: "safe", docId: "safe", tenantId: "ok", text: "alpha", embedding: [1, 0], acl });
    expect(() => index.search({ text: 'alpha" * NEAR', embedding: [1, 0], limit: 1, acl: { sql: "1", params: [] } })).not.toThrow();
  });

  it("rejects dimensions and limits with typed errors", () => {
    const index = createSearchIndex(":memory:", 2);
    expect(() => index.add({ chunkId: "x", docId: "d", tenantId: "t", text: "", embedding: [1], acl })).toThrowError(new SearchError("DIM"));
    expect(() => index.search({ text: "", embedding: [1, 0], limit: 0, acl: { sql: "1", params: [] } })).toThrowError(new SearchError("LIMIT"));
    expect(() => index.search({ text: "", embedding: [1], limit: 1, acl: { sql: "1", params: [] } })).toThrowError(new SearchError("DIM"));
  });

  it("removes every document chunk from both indexes", () => {
    const index = createSearchIndex(":memory:", 2);
    for (const chunkId of ["x", "y"]) index.add({ chunkId, docId: "d", tenantId: "t", text: "needle", embedding: [1, 0], acl });
    expect(index.remove("d", "t")).toBe(2);
    expect(index.remove("d", "t")).toBe(0);
    expect(index.search({ text: "needle", embedding: [1, 0], limit: 10, acl: { sql: "1", params: [] } })).toEqual([]);
  });

  it("keeps no body text: chunks has no text column and the db file never contains the phrase", () => {
    const path = join(mkdtempSync(join(tmpdir(), "hs-")), "i.db");
    const index = createSearchIndex(path, 2);
    const phrase = "zebra quartz marmalade";
    index.add({ chunkId: "c", docId: "d", tenantId: "t", text: phrase, embedding: [1, 0], acl });
    const raw = new DatabaseSync(path);
    raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    expect(Object.keys(raw.prepare("SELECT * FROM chunks").get() as object)).not.toContain("text");
    raw.close();
    const bytes = readdirSync(join(path, "..")).map((f) => readFileSync(join(path, "..", f)).toString("latin1"));
    for (const b of bytes) expect(b).not.toContain(phrase);
    const hits = index.search({ text: "marmalade", embedding: [0, 1], limit: 5, acl: { sql: "1", params: [] } });
    expect(hits).toEqual([{ chunkId: "c", docId: "d", score: expect.any(Number) }]);
    expect(index.remove("d", "t")).toBe(1);
    expect(index.search({ text: "marmalade", embedding: [0, 1], limit: 5, acl: { sql: "1", params: [] } })).toEqual([]);
  });
});
