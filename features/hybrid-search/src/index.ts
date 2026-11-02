import type { Acl } from "@anvesx/core-types";

export type Hit = { chunkId: string; docId: string; score: number };
export type AclFragment = { sql: string; params: unknown[] };
export type AddChunk = {
  chunkId: string;
  docId: string;
  tenantId: string;
  /** Tokenised for keyword search, never stored. */
  text: string;
  embedding: number[];
  acl: Acl;
};
export type SearchQuery = {
  text: string;
  embedding: number[];
  limit: number;
  /** Rank position to start at in the fused RRF order; integer >= 0, default 0. offset + limit must be <= MAX_WINDOW. */
  offset?: number;
  acl: AclFragment;
};
export interface SearchIndex {
  add(chunk: AddChunk): void;
  /** Atomically swap one doc's chunks: remove then add in one transaction. On any failure the old chunks stay. Every chunk must carry this docId and tenantId. */
  replace(docId: string, tenantId: string, chunks: AddChunk[]): void;
  search(query: SearchQuery): Hit[];
  remove(docId: string, tenantId: string): number;
  /** Overwrite the ACL copy on every chunk of one doc; returns chunks updated. */
  updateAcl(docId: string, tenantId: string, acl: Acl): number;
}

export { SearchError } from "./errors.js";
export { rrf } from "./rrf.js";
export { createSearchIndex } from "./search/index-db.js";
export { MAX_WINDOW } from "./search/validate.js";
