import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import { describe, expect, it } from "vitest";
import { type AddChunk, createSearchIndex } from "../../src/index.js";
import { insertChunk } from "../../src/write/insert.js";

const acl = { allowUsers: ["u"], allowGroups: [], version: 1 };
const chunk = (chunkId: string, over: Partial<AddChunk> = {}): AddChunk => ({
  chunkId,
  docId: "d",
  tenantId: "t",
  text: "needle",
  embedding: [1, 0],
  acl,
  ...over,
});

function build() {
  const path = join(mkdtempSync(join(tmpdir(), "hs-insert-")), "index.db");
  const index = createSearchIndex(path, 2);
  const db = new DatabaseSync(path, { allowExtension: true });
  sqliteVec.load(db);
  const ids = () =>
    index
      .search({ text: "needle", embedding: [1, 0], limit: 10, acl: { sql: "tenant_id = ?", params: ["t"] } })
      .map((hit) => hit.chunkId)
      .sort();
  return { db, ids, index };
}

describe("insertChunk", () => {
  it("writes a row visible through createSearchIndex", () => {
    const { db, ids } = build();
    insertChunk(db, chunk("a"));
    expect(ids()).toEqual(["a"]);
  });

  it("rolls back with the caller's transaction on a duplicate id", () => {
    const { db, ids, index } = build();
    index.add(chunk("taken"));
    db.exec("BEGIN IMMEDIATE");
    expect(() => {
      insertChunk(db, chunk("new"));
      insertChunk(db, chunk("taken"));
    }).toThrow();
    db.exec("ROLLBACK");
    expect(ids()).toEqual(["taken"]);
  });

  it("surfaces downstream insert errors", () => {
    const { db } = build();
    expect(() => insertChunk(db, chunk("bad", { embedding: [1] }))).toThrow();
  });
});
