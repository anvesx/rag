import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Pointer, Principal } from "@brain/core-types";
import { createAuditChain } from "@rag/audit-chain";
import { createAuditService, createFileAnchorStore } from "@rag/audit-service";
import { createCursorStore } from "@rag/change-cursor";
import { chunkText } from "@rag/chunker";
import { createGovernance } from "@rag/governance";
import { createSearchIndex } from "@rag/hybrid-search";
import { createIndexService } from "@rag/index-service";
import { createIngestion, type IngestionCounts } from "@rag/ingestion";
import { createRegistry } from "@rag/pointer-registry";
import { createQueryService } from "@rag/query-service";
import { type LiveOptions, liveSearch } from "./live.js";
import type { Source } from "./source.js";

export type StackOptions = LiveOptions & { clock?: () => number; maxAttempts?: number; auditKey?: string };

const EMBEDDING = [1, 0];

/** Every real package wired over the files in `dir`; reopening the same `dir` resumes. No app, no MCP. */
export function openStack(dir: string, sources: Record<string, Source>, opts: StackOptions = {}) {
  mkdirSync(dir, { recursive: true });
  const clock = opts.clock ?? (() => 1000);
  const registry = createRegistry(join(dir, "registry.db"));
  const index = createSearchIndex(join(dir, "search.db"), EMBEDDING.length);
  const cursors = createCursorStore(join(dir, "cursors.db"), clock);
  const auditDbPath = join(dir, "audit.db");
  const audit = createAuditService({
    chain: createAuditChain(auditDbPath),
    anchorStore: createFileAnchorStore(join(dir, "anchors.log")),
    clock: () => new Date(clock()),
  });
  const query = createQueryService({ index, registry });
  const auditKey = opts.auditKey ?? "integration-audit-key";
  const governance = createGovernance({ audit, query, auditKey });
  const searchLive = liveSearch({ index, registry, audit, auditKey, sources, embedding: EMBEDDING }, opts);
  const fetchText = async (p: Pointer) => (await sources[p.tenantId]!.fetch(p.address, { token: "t" })).text;
  const indexService = createIndexService({
    registry,
    index,
    fetchText,
    embed: async (texts) => texts.map(() => EMBEDDING),
    chunk: async (docId, text) => chunkText(docId, text),
  });
  const live = (tenantId: string): string[] =>
    registry
      .list({ tenantId, limit: 1000 })
      .filter((p) => p.deletedAt === null)
      .map((p) => p.id);
  const ingestion = createIngestion({
    runtime: { cursors, clock, ...(opts.maxAttempts !== undefined && { maxAttempts: opts.maxAttempts }) },
    connectorFor: (tenantId) => sources[tenantId],
    tokenFor: (tenantId) => (sources[tenantId] ? "t" : undefined),
    known: live,
    // Lifecycle tests delete down to zero documents on purpose.
    reapGuard: false,
    indexService,
  });
  return {
    registry,
    cursors,
    auditDbPath,
    registryPath: join(dir, "registry.db"),
    ingest: (tenantId: string): Promise<IngestionCounts> => ingestion.runOnce(tenantId),
    search: (who: Principal, text: string, limit?: number): Promise<Pointer[]> =>
      governance.search({ query: text, principal: who, embedding: EMBEDDING, ...(limit !== undefined && { limit }) }),
    searchLive,
    verify: governance.verify,
    checkpoint: governance.checkpoint,
    close: () => registry.close(),
  };
}

export type Stack = ReturnType<typeof openStack>;
