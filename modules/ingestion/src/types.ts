import type { Connector } from "@brain/connector-kit";
import type { Failure, RuntimeDeps } from "@rag/connector-runtime";
import type { IndexService } from "@rag/index-service";

export interface IngestionDeps {
  /** Everything `createConnectorRuntime` takes except the connector and the sink, which ingestion supplies. */
  runtime: Omit<RuntimeDeps, "sink" | "connector">;
  indexService: IndexService;
  /** The connector bound to this tenant, or undefined when the tenant is unknown. Never share one across tenants. */
  connectorFor(tenantId: string): Connector | undefined;
  /** The credential bound to this tenant, or undefined when the tenant is unknown. */
  tokenFor(tenantId: string): string | undefined;
  /**
   * Pointer ids (`docId`) the index already holds for the tenant, e.g. read from the registry after a restart.
   * Merged into the known set once a run has listed everything, so documents deleted at the source while the
   * process was down are tombstoned. Duplicates are fine. If it throws, the run rejects before any delete.
   */
  known?(tenantId: string): Iterable<string> | Promise<Iterable<string>>;
  /** Refuses suspicious delete passes (see `ReapGuard`). Default: 50% above 10 known docs, and any empty listing. `false` disables. */
  reapGuard?: ReapGuard | false;
  /** Receives a line when a delete pass is skipped. Never gets document text or tokens. */
  warn?(msg: string, fields: Record<string, unknown>): void;
}

export interface ReapGuard {
  /** Largest share of known documents one run may tombstone. Default 0.5. */
  maxFraction?: number;
  /** The share limit applies only with at least this many known documents. Default 10. */
  minDocs?: number;
}

export interface ReapSkipped {
  /** `empty-listing`: the complete listing held nothing. `too-many`: the run would tombstone more than `maxFraction`. */
  reason: "empty-listing" | "too-many";
  wouldDelete: number;
  known: number;
}

export interface IngestionCounts {
  /** Change events handed to the index (upserts and tombstones), including ones that failed. */
  emitted: number;
  /** Events the index applied as created, updated or deleted. */
  indexed: number;
  failed: number;
  /** Documents whose upsert or delete was rejected in this run. Empty means the run fully succeeded. */
  failures: Failure[];
  /** Documents given up on after repeated failures; skipped until a new version or ACL arrives. */
  quarantined: Failure[];
  /** Present only when a complete listing was not reaped because the guard refused it; no document was deleted. */
  reapSkipped?: ReapSkipped;
}

export interface Ingestion {
  /** Throws `IngestionError` `UNKNOWN_TENANT` when no connector or token is bound to the tenant. */
  runOnce(tenantId: string): Promise<IngestionCounts>;
}
