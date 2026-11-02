import type { Principal } from "@anvesx/core-types";
import type { AuditService } from "@rag/audit-service";
import { type McpServiceOptions, startMcpServer } from "@rag/mcp-service";
import { createQueryService, type QueryDeps } from "@rag/query-service";
import { type EmbedQuery, type OutcomeFn, toOutcomeFn, toSearchFn } from "./adapter.js";
import { type AuditKey, auditedOutcome } from "./audit.js";

export type RetrievalOptions = QueryDeps &
  Pick<McpServiceOptions, "transport" | "port" | "host" | "stdin" | "stdout" | "logger"> & {
    /** Derives the caller from transport metadata; must throw when unauthenticated. */
    principalFor: (extra: unknown) => Principal;
    /** Turns query text into the vector the index was built with. */
    embedQuery: EmbedQuery;
    /** Required. Every search writes one row here before results are returned; a failed write fails the search. */
    audit: AuditService;
    /** Required, non-empty master secret for the keyed audit target digest. */
    auditKey: AuditKey;
  };

/** `search` is the audited typed path the MCP tool uses: `{ ok: true, pointers, truncated, ... }` or `{ ok: false, code: "LIVE_ACL" }`. */
export type RetrievalHandle = { close(): Promise<void>; port: number | undefined; search: OutcomeFn };

/** Wires query-service (`searchLive`, with paging and the optional live ACL) into mcp-service, every search audited fail-closed. */
export async function createRetrieval(options: RetrievalOptions): Promise<RetrievalHandle> {
  const { embedQuery, audit, auditKey, index, registry, liveAcl, liveAclTimeoutMs, timer, maxCandidates, ...server } = options;
  const queryDeps: QueryDeps = {
    index,
    registry,
    ...(liveAcl && { liveAcl }),
    ...(liveAclTimeoutMs !== undefined && { liveAclTimeoutMs }),
    ...(timer && { timer }),
    ...(maxCandidates !== undefined && { maxCandidates }),
  };
  const search = auditedOutcome(toOutcomeFn(createQueryService(queryDeps), embedQuery), audit, auditKey);
  const running = await startMcpServer({ ...server, search: toSearchFn(search) });
  return { close: running.close, port: running.port, search };
}
