# Spec: audit-chain

Ticket: #36   Tier: feature   Milestone: M0   Design cards: acl.enf (ac_audit)

## Purpose
Append-only log where each entry's hash covers the previous one, so any edit or delete is detectable. Deleting the newest rows, or rewriting rows and recomputing every later hash, is detectable only against an externally stored anchor (the chain head); without one it is inherently undetectable.
## Reuse decision
`json-canonicalize` (RFC 8785) for stable bytes, `node:crypto` sha256, `node:sqlite`
storage with triggers that block UPDATE and DELETE, `fast-check@4.10.2` for properties.
## Public interface
```ts
export type AuditEvent = { tenantId: string; actor: string; action: string; target: string; at: string; detail?: Record<string, unknown> };
export interface AuditChain {
  append(e: AuditEvent): { seq: number; hash: string };
  head(tenantId: string): { seq: number; hash: string }; // seq 0 + 64 zeros when empty; store it outside the db
  verify(tenantId: string, anchor?: { seq: number; hash: string }): { ok: true } | { ok: false; brokenAt: number; anchor?: "truncated" | "mismatch" };
  list(tenantId: string, afterSeq?: number, limit?: number): (AuditEvent & { seq: number; hash: string })[];
}
export function createAuditChain(dbPath: string): AuditChain;
```
## Behaviour
1. hash = sha256(prevHash + canonical(event)); first entry's prev is 64 zeros. One chain per tenant.
2. `verify` recomputes from row 1 and reports the first bad seq. Tampering with any field, deleting a middle row, or reordering is caught. With an `anchor` (a previously returned `head`), `verify` also fails with `anchor: "truncated"` (fewer rows than `anchor.seq`) or `anchor: "mismatch"` (row `anchor.seq` has another hash). Without an anchor, tail truncation and a consistent full rewrite pass.
3. SQL UPDATE or DELETE on the table fails (trigger). Test attempts both.
4. Key order in `detail` does not change the hash; unicode and nested values work.
5. Concurrent appends from two handles never fork the chain (seq unique per tenant, transaction).
6. Event fields validated; bad input throws `AuditError("INVALID")`.
## Acceptance tests (first)
unit, property (random events verify ok; flipping any byte breaks), integration (reopen file, raw-SQL tamper detected), mutation >= 80, scale (50k appends, verify under 5 s).
## Layout
`features/audit-chain/src/{chain.ts,canonical.ts,store.ts,triggers.ts,errors.ts}`.
## Out of scope
Signing, storing or scheduling anchors (the caller keeps them), retention.
