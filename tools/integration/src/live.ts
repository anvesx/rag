import type { Pointer, Principal } from "@brain/core-types";
import type { AuditService } from "@rag/audit-service";
import { createQueryService, type QueryDeps } from "@rag/query-service";
import { auditedOutcome, createConnectorLiveAcl, toOutcomeFn, toSearchFn } from "@rag/retrieval";
import type { Source } from "./source.js";

export type LiveOptions = {
  /** The user's own token at the source. Without it there is no live ACL. */
  userTokenFor?: (who: Principal) => string | undefined;
  liveAclTimeoutMs?: number;
};

type Parts = Pick<QueryDeps, "index" | "registry"> & { audit: AuditService; auditKey: string; sources: Record<string, Source>; embedding: number[] };

/** Audited search with the connector live ACL; rejects with RetrievalError LIVE_ACL when nothing can be verified. */
export function liveSearch({ index, registry, audit, auditKey, sources, embedding }: Parts, opts: LiveOptions) {
  const { userTokenFor, liveAclTimeoutMs } = opts;
  const liveAcl = userTokenFor && createConnectorLiveAcl({ connectorFor: (t) => sources[t], userTokenFor, pointerFor: (t, id) => registry.get(t, id) });
  const query = createQueryService({ index, registry, ...(liveAcl && { liveAcl }), ...(liveAclTimeoutMs !== undefined && { liveAclTimeoutMs }) });
  const run = toSearchFn(
    auditedOutcome(
      toOutcomeFn(query, () => embedding),
      audit,
      auditKey,
    ),
  );
  return (who: Principal, text: string, limit = 10): Promise<Pointer[]> => run({ query: text, limit, principal: who });
}
