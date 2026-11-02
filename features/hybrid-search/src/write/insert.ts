import type { DatabaseSync } from "node:sqlite";
import type { AddChunk } from "../index.js";
import { addFts } from "../search/fts.js";
import { addVec } from "../search/vec.js";

/** Insert one chunk into all three tables. The caller owns the transaction. */
export function insertChunk(db: DatabaseSync, chunk: AddChunk): void {
  const row = db
    .prepare("INSERT INTO chunks(chunk_id,doc_id,tenant_id,allow_users,allow_groups) VALUES(?,?,?,?,?)")
    .run(chunk.chunkId, chunk.docId, chunk.tenantId, JSON.stringify(chunk.acl.allowUsers), JSON.stringify(chunk.acl.allowGroups));
  addFts(db, Number(row.lastInsertRowid), chunk.text);
  addVec(db, Number(row.lastInsertRowid), chunk.embedding);
}
