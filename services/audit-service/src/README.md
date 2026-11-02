# Source layout

- `types.ts` holds the public types: `AuditService`, `AnchorStore`, `AnchorRecord`, `VerifyResult`.
- `service.ts` implements `createAuditService`: stamps `at` from the clock, checkpoints, verifies against the latest anchor.
- `file-store.ts` is a JSON-lines `AnchorStore` that only appends and rejects corrupt lines.
- `errors.ts` holds `AuditServiceError` (`ANCHOR_STORE`, `CLOCK`) and `AnchorStoreError`.
- `index.ts` exposes the supported package API.

All runtime imports use ESM `.js` suffixes. Errors from `@rag/audit-chain` (`AuditError`) pass through unchanged.
