import type { Connector } from "@anvesx/connector-kit";
import type { CursorStore } from "@rag/change-cursor";

/** One document at one version and ACL, delivered to the sink at most once per tenant. */
export interface ChangeEvent {
  tenantId: string;
  connectorId: string;
  address: string;
  version: string;
  title: string;
  /** Injected clock reading, ms. */
  emittedAt: number;
}

export type Sink = (event: ChangeEvent) => void | Promise<void>;

export interface RuntimeDeps {
  connector: Connector;
  cursors: CursorStore;
  sink: Sink;
  clock: () => number;
  /** Items per list call, integer 1-1000. Default 100. */
  pageSize?: number;
  /** Failed deliveries of one event before it is quarantined, integer 1-20. Default 3. */
  maxAttempts?: number;
}

/** One document the sink rejected. `error` is the sink error's message. */
export interface Failure {
  address: string;
  error: string;
}

export interface RunResult {
  emitted: number;
  skipped: number;
  /** True when a BAD_CURSOR forced a full rescan. */
  restarted: boolean;
  /** Deliveries the sink rejected in this run, including the one that triggered quarantine. */
  failures: Failure[];
  /** Every document currently quarantined for the tenant (retries exhausted, until a new version or ACL). */
  quarantined: Failure[];
}

export interface ConnectorRuntime {
  runOnce(tenantId: string): Promise<RunResult>;
}
