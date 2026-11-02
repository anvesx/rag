import { createHmac } from "node:crypto";
import type { AuditService } from "@rag/audit-service";
import type { Outcome, OutcomeFn, SearchFn, SearchRequest } from "./adapter.js";
import { RetrievalError } from "./errors.js";

export type AuditKey = string | Uint8Array;

/**
 * Wraps a search so results are returned only after one audit row is written; a failed write rejects.
 * `count` is the row's result count; `extra` adds detail fields (a refusal is recorded as outcome "failure", count 0).
 * Mirrors @rag/governance (a module cannot import another module, so this is a deliberate small duplicate).
 * Target = HMAC(HMAC(master, tenant), trimmed query): keyed, per tenant, no raw query stored.
 */
function audited<T>(
  search: (q: SearchRequest) => Promise<T>,
  audit: AuditService,
  auditKey: AuditKey,
  count: (result: T) => number,
  extra: (result: T) => Record<string, unknown> = () => ({}),
) {
  if (!audit) throw new RetrievalError("CONFIG", "audit is required");
  if (!auditKey || auditKey.length === 0) throw new RetrievalError("CONFIG", "auditKey is required");
  const digest = (tenantId: string, query: string): string => {
    const tenantKey = createHmac("sha256", auditKey).update(`rag-audit-target-key:${tenantId}`).digest();
    return createHmac("sha256", tenantKey).update(query.trim(), "utf8").digest("hex");
  };
  return async (request: SearchRequest): Promise<T> => {
    const results = await search(request);
    const rows = count(results);
    const { id, tenantId } = request.principal;
    try {
      await audit.record(tenantId, { actor: id, action: "search", target: digest(tenantId, request.query), detail: { count: rows, ...extra(results) } });
    } catch (cause) {
      throw new RetrievalError("AUDIT", "audit record failed", { cause });
    }
    return results;
  };
}

export const auditedSearch = (search: SearchFn, audit: AuditService, auditKey: AuditKey): SearchFn => audited(search, audit, auditKey, (r) => r.length);

/** Same audit rule for typed outcomes: ok results write a row; a LIVE_ACL failure writes a failure row with zero results. */
export const auditedOutcome = (outcome: OutcomeFn, audit: AuditService, auditKey: AuditKey): OutcomeFn =>
  audited(
    outcome,
    audit,
    auditKey,
    (r: Outcome) => (r.ok ? r.pointers.length : 0),
    (r: Outcome) => (r.ok ? {} : { outcome: "failure", code: r.code }),
  );
