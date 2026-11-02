import { DatabaseSync } from "node:sqlite";
import type { Acl } from "@anvesx/core-types";
import * as sqliteVec from "sqlite-vec";
import { SearchError } from "../errors.js";
import type { AddChunk, Hit, SearchIndex, SearchQuery } from "../index.js";
import { rrf } from "../rrf.js";
import { insertChunk } from "../write/insert.js";
import { createChunks, hydrate, removeDoc, setAcl } from "./db.js";
import { createFts, searchFts } from "./fts.js";
import { MAX_WINDOW, validateChunk, validateEmbedding, validateWindow, validText } from "./validate.js";
import { createVec, searchVec } from "./vec.js";

function initialize(path: string, dim: number): DatabaseSync {
  if (!Number.isInteger(dim) || dim < 1 || dim > 4096) throw new SearchError("DIM");
  const db = new DatabaseSync(path, { allowExtension: true });
  sqliteVec.load(db);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000");
  createChunks(db);
  createFts(db);
  createVec(db, dim);
  return db;
}

/** `close()` releases the SQLite handle; later calls throw. */
export function createSearchIndex(path: string, dim: number): SearchIndex & { close(): void } {
  const db = initialize(path, dim);
  const tx = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (error) {
      db.exec("ROLLBACK");
      throw new SearchError(String(error).includes("UNIQUE") ? "DUPLICATE" : "DB", error);
    }
  };
  return {
    add(chunk: AddChunk): void {
      validateChunk(chunk, dim);
      tx(() => insertChunk(db, chunk));
    },
    replace(docId: string, tenantId: string, chunks: AddChunk[]): void {
      if (!validText(docId) || !validText(tenantId) || !Array.isArray(chunks)) throw new SearchError("INPUT");
      for (const chunk of chunks) {
        validateChunk(chunk, dim);
        if (chunk.docId !== docId || chunk.tenantId !== tenantId) throw new SearchError("INPUT");
      }
      // One transaction: any failure rolls back the remove too, so the old chunks stay searchable.
      tx(() => {
        removeDoc(db, docId, tenantId);
        for (const chunk of chunks) insertChunk(db, chunk);
      });
    },
    search(query: SearchQuery): Hit[] {
      validateEmbedding(query?.embedding, dim);
      const { limit, offset } = validateWindow(query ?? {});
      if (typeof query.text !== "string" || typeof query.acl?.sql !== "string" || query.acl.sql.trim() === "") throw new SearchError("INPUT");
      try {
        // Every page fuses the same top-MAX_WINDOW of each list, so the order is identical on all pages.
        const lists = [searchFts(db, query.text, MAX_WINDOW, query.acl), searchVec(db, query.embedding, MAX_WINDOW, query.acl)];
        return hydrate(db, rrf(lists).slice(offset, offset + limit));
      } catch (error) {
        throw error instanceof SearchError ? error : new SearchError("DB", error);
      }
    },
    remove(docId: string, tenantId: string): number {
      if (!validText(docId) || !validText(tenantId)) throw new SearchError("INPUT");
      return tx(() => removeDoc(db, docId, tenantId));
    },
    updateAcl(docId: string, tenantId: string, acl: Acl): number {
      if (!validText(docId) || !validText(tenantId)) throw new SearchError("INPUT");
      return tx(() => setAcl(db, docId, tenantId, acl));
    },
    close: () => db.close(),
  };
}
