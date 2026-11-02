import type { Readable, Writable } from "node:stream";
import type { Connector } from "@brain/connector-kit";
import type { Pointer, Principal } from "@brain/core-types";
import type { CursorStore } from "@rag/change-cursor";
import type { Governance } from "@rag/governance";
import type { IngestionCounts } from "@rag/ingestion";
import type { Timeouts } from "./config/ops.js";

export type Logger = {
  error(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
};

export type RagDeps = {
  /** The connector bound to a tenant, or undefined for an unknown tenant. Never one connector for several tenants. */
  connectorFor: (tenantId: string) => Connector | undefined;
  /** The credential bound to a tenant, or undefined for an unknown tenant. */
  tokenFor: (tenantId: string) => string | undefined;
  /** Default: a file under `dataDir`, or in memory when `dataDir` is unset. */
  cursors?: CursorStore | undefined;
  /** Directory for the pointer registry, search index and cursor store. Omitted: all in memory, lost on restart. */
  dataDir?: string | undefined;
  /** Default: JSON lines on stderr. Never receives query text or tokens. */
  logger?: Logger | undefined;
  /** Milliseconds. Drives ingestion cursors and audit timestamps. */
  clock: () => number;
  embed: (texts: string[]) => Promise<number[][]>;
  embedQuery: (text: string) => Promise<number[]>;
  /** Reads a pointer's text for indexing. Omitted: the tenant's connector fetches it with the tenant credential. */
  fetchText?: ((pointer: Pointer) => Promise<string>) | undefined;
  /**
   * The user's own credential at the source. When set, every search re-checks each hit at the source with that
   * token (live ACL) and fails closed on denial, error or timeout. Omitted: cached ACLs only.
   */
  userTokenFor?: ((principal: Principal) => string | undefined) | undefined;
  /** Milliseconds the live check may take before the search fails closed. Default: query-service's. */
  liveAclTimeoutMs?: number | undefined;
  /** Derives the caller from transport metadata; must throw when unauthenticated. */
  principalFor: (extra: unknown) => Principal;
  /** Secret for keyed query digests in audit rows. Never hard-code outside demo. */
  auditKey: string | Uint8Array;
  auditDbPath: string;
  /** Checkpoint log. Keep it outside the audit database. */
  anchorPath: string;
  transport: "http" | "stdio";
  /** http only; 0 or omitted picks a free port. */
  port?: number | undefined;
  /** Vector size. Omitted: measured by embedding one probe text at startup. */
  dimension?: number | undefined;
  /** Resolves once the embedding model can load, rejects while it cannot; `/readyz` is 503 until it resolves. Omitted: nothing to wait for. */
  ready?: (() => Promise<void>) | undefined;
  /** Bind address; default loopback. Host (with port) and Origin allow-lists default to loopback on the bound port. */
  host?: string | undefined;
  allowedHosts?: string[] | undefined;
  allowedOrigins?: string[] | undefined;
  /** Per-call limits on embed, embedQuery, fetchText and connector.list; each defaults to DEFAULT_TIMEOUTS. */
  timeouts?: Partial<Timeouts> | undefined;
  /** Milliseconds close() waits for in-flight requests before cutting them off. Default 10000. */
  drainMs?: number | undefined;
  /** Serve /healthz and /readyz on this port; omitted: off. */
  healthPort?: number | undefined;
  /** stdio only; default to process stdin and stdout. */
  stdin?: Readable | undefined;
  stdout?: Writable | undefined;
};

export type SearchInput = { query: string; principal: Principal; limit?: number };

export type RagApp = {
  ingest(tenantId: string): Promise<IngestionCounts>;
  /** Audited search, the same path the MCP tool uses. */
  search(input: SearchInput): Promise<Pointer[]>;
  verify: Governance["verify"];
  checkpoint: Governance["checkpoint"];
  /** Idempotent. */
  close(): Promise<void>;
  port: number | undefined;
  healthPort: number | undefined;
};
