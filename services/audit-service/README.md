# @rag/audit-service

Durable audit with external anchors. Wraps `@rag/audit-chain` (hash chain in SQLite) and adds
checkpoints written to an append-only store outside the database, so deleting the newest rows is
detected. Spec: `docs/specs/service/audit-service.md`.

## Interface

```ts
import { createAuditChain } from "@rag/audit-chain";
import { createAuditService, createFileAnchorStore } from "@rag/audit-service";

const svc = createAuditService({
  chain: createAuditChain("/var/lib/rag/audit.db"),
  anchorStore: createFileAnchorStore("/mnt/other-host/anchors.jsonl"), // keep it away from the db
  clock: () => new Date(),
});
await svc.record("acme", { actor: "alice", action: "doc.read", target: "doc/42", detail: { via: "api" } });
await svc.checkpoint("acme"); // appends { tenantId, seq, hash, at } to the anchor store
await svc.verify("acme"); // { status: "ok" } | { status: "mismatch" | "truncated", brokenAt }
```

## Behaviour

- `record` stamps `at` from the injected clock. Concurrent calls are ordered by call order and never fork the chain.
- `checkpoint` writes the tenant's chain head (empty chain: seq 0) to the anchor store.
- `verify` checks the chain against the tenant's latest anchor. No anchor means chain self-consistency only.
- `mismatch`: a row was edited or the anchored hash differs. `truncated`: rows after the anchor are gone.
- Tenants are independent: each has its own chain and its own latest anchor.
- Errors: `AnchorStoreError` (`code "ANCHOR_STORE"`, original on `cause`), `AuditServiceError` with `code "CLOCK"`.
  `AuditError` from the chain (`INVALID`, `STORAGE`) passes through.

## Limits

- Only checkpointed history is protected. Rows added after the last checkpoint can be removed undetected.
- The anchor store is only as trustworthy as its location. Someone who can rewrite it can hide tampering.
- `@brain/core-types` is not imported: nothing here needs it.

## Test

```
pnpm --filter @rag/audit-service test
pnpm --filter @rag/audit-service typecheck
pnpm --filter @rag/audit-service mutation
```

`@rag/audit-chain` must be built first (`pnpm --filter @rag/audit-chain build`).
