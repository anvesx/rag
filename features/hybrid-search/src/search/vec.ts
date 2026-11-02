import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { AclFragment } from "../index.js";
import { sqlParams } from "./db.js";

const MAX_KNN = 4096;

export function createVec(db: DatabaseSync, dim: number): void {
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[${dim}])`);
}

export function addVec(db: DatabaseSync, rowid: number, embedding: number[]): void {
  db.prepare("INSERT INTO chunks_vec(rowid, embedding) VALUES (?, ?)").run(BigInt(rowid), new Float32Array(embedding));
}

export function searchVec(db: DatabaseSync, embedding: number[], limit: number, acl: AclFragment): string[] {
  const sql = `SELECT chunks.rowid AS id FROM chunks_vec
    JOIN chunks ON chunks.rowid = chunks_vec.rowid
    WHERE chunks_vec.embedding MATCH ? AND k = ? AND (${acl.sql})
    ORDER BY chunks_vec.distance, chunks.chunk_id LIMIT ?`;
  const params = sqlParams(acl.params);
  const total = count(db, "1", []);
  const allowed = count(db, acl.sql, params);
  if (allowed === 0) return [];
  const cap = Math.min(total, MAX_KNN);
  let candidates = allowed === total ? limit : Math.min(cap, limit * 8);
  for (;;) {
    const rows = db.prepare(sql).all(new Float32Array(embedding), candidates, ...params, limit);
    if (rows.length >= limit || candidates >= total) {
      return rows.map((row) => String(row.id));
    }
    if (candidates >= cap) return exactScan(db, embedding, limit, acl);
    candidates = Math.min(cap, candidates * 2);
  }
}

function count(db: DatabaseSync, where: string, params: SQLInputValue[]): number {
  const row = db.prepare(`SELECT count(*) AS n FROM chunks WHERE (${where})`).get(...params);
  return Number(row!.n);
}

// vec0 caps knn at 4096; selective ACLs fall back to a scan over allowed rows.
function exactScan(db: DatabaseSync, embedding: number[], limit: number, acl: AclFragment): string[] {
  const sql = `SELECT chunks.rowid AS id FROM chunks
    JOIN chunks_vec ON chunks_vec.rowid = chunks.rowid
    WHERE (${acl.sql})
    ORDER BY vec_distance_l2(chunks_vec.embedding, ?), chunks.chunk_id LIMIT ?`;
  return db
    .prepare(sql)
    .all(...sqlParams(acl.params), new Float32Array(embedding), limit)
    .map((row) => String(row.id));
}
