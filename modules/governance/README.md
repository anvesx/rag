# @rag/governance

Audited access. Wraps a query service so every search leaves one audit row. Spec: `docs/specs/module/governance.md`.

## Interface

```ts
import { createGovernance } from "@rag/governance";

const gov = createGovernance({ audit, query, auditKey }); // audit: @rag/audit-service, query: @rag/query-service, auditKey: required non-empty secret (string | Uint8Array)
await gov.search({ query, principal, embedding }); // Pointer[]
await gov.checkpoint("acme"); // Anchor
await gov.verify("acme"); // { status: "ok" } | { status: "mismatch" | "truncated", brokenAt }
class GovernanceError extends Error {
  code: "AUDIT" | "CONFIG";
} // original error on `cause`
```

## Behaviour

1. `search` runs the query, then records `{ actor: principal.id, action: "search", target: HMAC(HMAC(auditKey, tenant), trimmed query), detail: { count } }` under the principal's tenant, then returns.
2. Fail closed: if the audit write fails, `search` rejects with `GovernanceError` `AUDIT` and returns no results.
3. Query errors (`QueryError`) pass through unchanged. A search that never ran leaves no row.
4. The raw query text is never stored. Only a per-tenant keyed HMAC-SHA256 digest is, so short queries cannot be recovered with a dictionary of plain hashes. Same query and tenant give the same digest; another tenant or key gives a different one.
5. A missing or empty `auditKey` throws `GovernanceError` `CONFIG` from `createGovernance`.
6. `verify` and `checkpoint` delegate to the audit service. Their failures are wrapped in `GovernanceError` `AUDIT`.
7. Tenants are independent because the audit service keeps one chain per tenant.

## Limits

- The row is written after the search runs, so a crash between the two can return nothing yet leave no row. It never returns results without a row.
- Tail truncation is only detected for history covered by a `checkpoint`. Call it on a schedule.
- Records the search, not which documents came back. The count is the only result detail.

## Test

`pnpm test`, `pnpm typecheck`, `pnpm mutation` from this folder. Build first: core-types, audit-chain, acl-filter, hybrid-search, pointer-registry, audit-service, query-service.
