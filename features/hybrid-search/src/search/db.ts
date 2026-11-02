import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Acl } from "@anvesx/core-types";
import { SearchError } from "../errors.js";
import type { Hit } from "../index.js";
import type { RankedId } from "../rrf.js";

export function sqlParams(values: unknown[]): SQLInputValue[] {
  if (!Array.isArray(values)) throw new SearchError("ACL");
  const valid = values.every((value) => value === null || ["string", "number", "bigint"].includes(typeof value) || value instanceof Uint8Array);
  if (!valid) throw new SearchError("ACL");
  return values as SQLInputValue[];
}

/** Ranked ids are chunk rowids (chunk_id is only unique per tenant). */
export function hydrate(db: DatabaseSync, ranked: RankedId[]): Hit[] {
  const find = db.prepare("SELECT chunk_id, doc_id FROM chunks WHERE rowid = ?");
  return ranked.map(({ id, score }) => {
    const row = find.get(Number(id))!;
    return { chunkId: String(row.chunk_id), docId: String(row.doc_id), score };
  });
}

/** Pointer-only: no body text column. */
export function createChunks(db: DatabaseSync): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS chunks (chunk_id TEXT NOT NULL, doc_id TEXT NOT NULL, tenant_id TEXT NOT NULL, allow_users TEXT NOT NULL, allow_groups TEXT NOT NULL, UNIQUE(tenant_id, chunk_id))",
  );
  db.exec("CREATE INDEX IF NOT EXISTS chunks_tenant ON chunks(tenant_id)");
}

export function removeDoc(db: DatabaseSync, docId: string, tenantId: string): number {
  const ids = db
    .prepare("SELECT rowid FROM chunks WHERE doc_id=? AND tenant_id=?")
    .all(docId, tenantId)
    .map((r) => Number(r.rowid));
  for (const id of ids) {
    db.prepare("DELETE FROM chunks_fts WHERE rowid=?").run(id);
    db.prepare("DELETE FROM chunks_vec WHERE rowid=?").run(id);
  }
  db.prepare("DELETE FROM chunks WHERE doc_id=? AND tenant_id=?").run(docId, tenantId);
  return ids.length;
}

export function setAcl(db: DatabaseSync, docId: string, tenantId: string, acl: Acl): number {
  const r = db
    .prepare("UPDATE chunks SET allow_users=?, allow_groups=? WHERE doc_id=? AND tenant_id=?")
    .run(JSON.stringify(acl.allowUsers), JSON.stringify(acl.allowGroups), docId, tenantId);
  return Number(r.changes);
}
