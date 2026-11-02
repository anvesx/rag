import { createHmac } from "node:crypto";
import { GovernanceError } from "./errors.js";

export type AuditKey = string | Uint8Array;

/** Returns a function that maps (tenant, query) to a keyed digest. The key is per tenant: HMAC(master, tenant). */
export function createTargetDigest(auditKey: AuditKey | undefined): (tenantId: string, query: string) => string {
  if (auditKey === undefined || auditKey.length === 0) throw new GovernanceError("CONFIG", "auditKey is required");
  return (tenantId, query) => {
    const tenantKey = createHmac("sha256", auditKey).update(`rag-audit-target-key:${tenantId}`).digest();
    return createHmac("sha256", tenantKey).update(query.trim(), "utf8").digest("hex");
  };
}
