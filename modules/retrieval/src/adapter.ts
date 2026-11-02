import type { Pointer, Principal } from "@anvesx/core-types";
import { type LiveQueryService, QueryError, type SearchResult, validate } from "@rag/query-service";
import { RetrievalError } from "./errors.js";

export type SearchRequest = { query: string; limit: number; principal: Principal };
export type SearchFn = (q: SearchRequest) => Promise<Pointer[]>;
export type EmbedQuery = (text: string) => Promise<number[]> | number[];

/**
 * Typed result of one search. `truncated` (the scan hit its candidate cap, so more matches may exist) rides on ok results.
 * `degraded` is true when results survived but some hits could not be verified (a partial live ACL outage); absent otherwise.
 * LIVE_ACL means the live ACL check could not vouch for any hit; nothing is returned (fail closed).
 */
export type Outcome = ({ ok: true; degraded?: true } & SearchResult) | { ok: false; code: "LIVE_ACL" };
export type OutcomeFn = (q: SearchRequest) => Promise<Outcome>;

const liveFailure: Outcome = { ok: false, code: "LIVE_ACL" };

/** Validates and trims the request, embeds the trimmed query, then pages through the query service (`searchLive`). Other failures reject. */
export function toOutcomeFn(service: Pick<LiveQueryService, "searchLive">, embedQuery: EmbedQuery): OutcomeFn {
  return async ({ query, limit, principal }) => {
    // Fail on bad input before paying for an embedding; embed the same trimmed text the index and audit use.
    const { text } = validate({ query, principal, limit, embedding: [] });
    const embedding = await embedQuery(text);
    try {
      const result = await service.searchLive({ query: text, principal, limit, embedding });
      // Nothing returned and something could not be verified: a verifier outage must not look like "no results".
      if (result.pointers.length === 0 && result.liveUnverified > 0) return liveFailure;
      return { ok: true, ...(result.liveUnverified > 0 && { degraded: true as const }), ...result };
    } catch (error) {
      if (error instanceof QueryError && error.code === "LIVE_ACL") return liveFailure;
      throw error;
    }
  };
}

/** The pointer-only function the MCP tool expects. A LIVE_ACL outcome rejects, so the caller sees a safe error. */
export function toSearchFn(outcome: OutcomeFn): SearchFn {
  return async (request) => {
    const result = await outcome(request);
    if (!result.ok) throw new RetrievalError(result.code, "live acl check failed");
    return result.pointers;
  };
}
