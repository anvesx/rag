import { AnchorStoreError, AuditServiceError } from "./errors.js";
import type { AnchorRecord, AuditService, AuditServiceDeps, VerifyResult } from "./types.js";

export function createAuditService({ chain, anchorStore, clock }: AuditServiceDeps): AuditService {
  const now = (): string => {
    const d = clock();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new AuditServiceError("CLOCK", "clock returned an invalid date");
    return d.toISOString();
  };
  const store = async <T>(what: string, op: () => Promise<T>): Promise<T> => {
    try {
      return await op();
    } catch (cause) {
      if (cause instanceof AnchorStoreError) throw cause;
      throw new AnchorStoreError(`anchor store ${what} failed`, cause);
    }
  };

  return {
    // chain.append is synchronous, so concurrent callers are ordered by call order and never fork the chain.
    async record(tenantId, event) {
      return chain.append({ ...event, tenantId, at: now() });
    },
    async checkpoint(tenantId) {
      const head = chain.head(tenantId);
      const record: AnchorRecord = { tenantId, seq: head.seq, hash: head.hash, at: now() };
      await store("append", () => anchorStore.append(record));
      return head;
    },
    async verify(tenantId): Promise<VerifyResult> {
      const latest = await store("read", () => anchorStore.latest(tenantId));
      const v = chain.verify(tenantId, latest && { seq: latest.seq, hash: latest.hash });
      if (v.ok) return { status: "ok" };
      return { status: v.anchor === "truncated" ? "truncated" : "mismatch", brokenAt: v.brokenAt };
    },
  };
}
