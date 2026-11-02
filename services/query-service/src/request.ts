import { type Pointer, type Principal, PrincipalSchema } from "@anvesx/core-types";
import type { SearchIndex } from "@rag/hybrid-search";
import type { Registry } from "@rag/pointer-registry";
import { QueryError } from "./errors.js";
import type { LiveAcl, Timer } from "./paging/live.js";
import type { ScanResult } from "./paging/scan.js";

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const DEFAULT_LIVE_TIMEOUT_MS = 2000;
export type SearchRequest = { query: string; principal: Principal; embedding: number[]; limit?: number };

export type PagedIndex = Pick<SearchIndex, "search">;
export type QueryDeps = {
  index: PagedIndex;
  registry: Pick<Registry, "get">;
  liveAcl?: LiveAcl;
  liveAclTimeoutMs?: number;
  timer?: Timer;
  /** Hard cap on index hits examined per search. */
  maxCandidates?: number;
};
export type SearchResult = ScanResult & { liveDenied: number; liveUnverified: number };
export interface QueryService {
  /** Sync cached-ACL search. Throws LIVE_ACL when a live verifier is configured. */
  search(request: SearchRequest): Pointer[];
}
/** Kept separate so existing `QueryService` consumers and stubs are unaffected. */
export interface LiveQueryService extends QueryService {
  searchLive(request: SearchRequest): Promise<SearchResult>;
}

/** Validate caller input; throws a typed QueryError before any IO. */
export function validate(request: SearchRequest): { limit: number; principal: Principal; text: string } {
  const limit = request?.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new QueryError("LIMIT");
  const parsed = PrincipalSchema.safeParse(request?.principal);
  if (!parsed.success) throw new QueryError("PRINCIPAL");
  const text = typeof request.query === "string" ? request.query.trim() : "";
  if (text === "") throw new QueryError("EMPTY_QUERY");
  return { limit, principal: parsed.data, text };
}
