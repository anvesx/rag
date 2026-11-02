import type { DatabaseSync } from "node:sqlite";
import { escapeFts } from "../escape.js";
import type { AclFragment } from "../index.js";
import { sqlParams } from "./db.js";

/** Contentless: FTS5 keeps tokens and positions only, never the body text (pointer-only index). */
export function createFts(db: DatabaseSync): void {
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text, content='', contentless_delete=1)");
}

export function addFts(db: DatabaseSync, rowid: number, text: string): void {
  db.prepare("INSERT INTO chunks_fts(rowid, text) VALUES (?, ?)").run(rowid, text);
}

export function searchFts(db: DatabaseSync, text: string, limit: number, acl: AclFragment): string[] {
  const expression = escapeFts(text);
  if (expression === "") return [];
  const sql = `SELECT chunks.rowid AS id FROM chunks_fts
    JOIN chunks ON chunks.rowid = chunks_fts.rowid
    WHERE chunks_fts MATCH ? AND (${acl.sql})
    ORDER BY bm25(chunks_fts), chunks.chunk_id LIMIT ?`;
  return db
    .prepare(sql)
    .all(expression, ...sqlParams(acl.params), limit)
    .map((row) => String(row.id));
}
