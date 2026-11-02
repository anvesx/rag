import { createAuditService, createFileAnchorStore } from "@rag/audit-service";
import { chunkText } from "@rag/chunker";
import { createGovernance } from "@rag/governance";
import { createIndexService } from "@rag/index-service";
import { createIngestion } from "@rag/ingestion";
import { createQueryService } from "@rag/query-service";
import { liveSearch } from "../live/search.js";
import { textFetcher } from "../runtime/fetch.js";
import { liveIds } from "../runtime/known.js";
import type { openStores } from "../runtime/stores.js";
import type { Logger, RagApp, RagDeps } from "../types.js";

/** Ingestion, audit, governance and (live or cached) search over the opened stores. `deps` must already carry the timeouts. */
export function createPipeline(deps: RagDeps, stores: ReturnType<typeof openStores>, logger: Logger) {
  const { registry, index, cursors, chain } = stores;
  const query = createQueryService({ index, registry });
  const audit = createAuditService({ chain, anchorStore: createFileAnchorStore(deps.anchorPath), clock: () => new Date(deps.clock()) });
  const governance = createGovernance({ audit, query, auditKey: deps.auditKey });
  const indexService = createIndexService({
    registry,
    index,
    embed: deps.embed,
    fetchText: textFetcher(deps),
    chunk: async (docId, text) => chunkText(docId, text),
  });
  const ingestion = createIngestion({
    runtime: { cursors, clock: deps.clock },
    connectorFor: deps.connectorFor,
    tokenFor: deps.tokenFor,
    // Only this connector's pointers: a second source in the registry must never be reaped by this listing.
    known: (tenantId) => liveIds(registry, tenantId, deps.connectorFor(tenantId)?.id ?? ""),
    warn: (msg, fields) => logger.warn(msg, fields),
    indexService,
  });
  const governed: RagApp["search"] = async ({ query: text, principal, limit }) =>
    governance.search({ query: text, principal, embedding: await deps.embedQuery(text), ...(limit !== undefined && { limit }) });
  return {
    ingest: (tenantId: string) => ingestion.runOnce(tenantId),
    search: deps.userTokenFor ? liveSearch({ deps, index, registry, audit, userTokenFor: deps.userTokenFor }) : governed,
    verify: governance.verify,
    checkpoint: governance.checkpoint,
  };
}
