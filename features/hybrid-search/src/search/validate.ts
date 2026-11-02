import { SearchError } from "../errors.js";
import type { AddChunk } from "../index.js";

/** Per-list fetch cap: offset + limit of one search may not exceed it (FTS and vec each return up to this many rows). */
export const MAX_WINDOW = 1000;

export function validText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

export function validateEmbedding(value: unknown, dim: number): asserts value is number[] {
  if (!Array.isArray(value) || value.length !== dim || value.some((n) => !Number.isFinite(n))) throw new SearchError("DIM");
}

/** `limit` is 1..100 (LIMIT); `offset` is an integer >= 0 with offset + limit <= MAX_WINDOW (OFFSET). */
export function validateWindow(query: { limit?: unknown; offset?: unknown }): { limit: number; offset: number } {
  const { limit, offset = 0 } = query;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new SearchError("LIMIT");
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset + limit > MAX_WINDOW) throw new SearchError("OFFSET");
  return { limit, offset };
}

/** Everything `add` checks before touching the database. */
export function validateChunk(chunk: AddChunk, dim: number): void {
  validateEmbedding(chunk?.embedding, dim);
  if (!validText(chunk?.chunkId) || !validText(chunk?.docId) || !validText(chunk?.tenantId) || typeof chunk?.text !== "string") throw new SearchError("INPUT");
}
