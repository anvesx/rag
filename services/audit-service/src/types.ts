import type { Anchor, AuditChain, AuditEvent } from "@rag/audit-chain";

export type { Anchor, AuditChain };

/** One checkpoint line. `at` is the clock time of the checkpoint. */
export type AnchorRecord = Anchor & { tenantId: string; at: string };

/** Append-only store that must live outside the audit database (another file, host or log). */
export interface AnchorStore {
  append(record: AnchorRecord): Promise<void>;
  /** Most recently appended record for the tenant, or undefined. */
  latest(tenantId: string): Promise<AnchorRecord | undefined>;
}

/** The caller supplies who did what; `tenantId` is the first argument and `at` comes from the clock. */
export type RecordInput = Omit<AuditEvent, "tenantId" | "at">;

export type VerifyResult = { status: "ok" } | { status: "mismatch"; brokenAt: number } | { status: "truncated"; brokenAt: number };

export interface AuditService {
  record(tenantId: string, event: RecordInput): Promise<Anchor>;
  checkpoint(tenantId: string): Promise<Anchor>;
  verify(tenantId: string): Promise<VerifyResult>;
}

export interface AuditServiceDeps {
  chain: AuditChain;
  anchorStore: AnchorStore;
  clock: () => Date;
}
