# @rag/ingestion

Connector to index pipeline. Spec: `docs/specs/module/ingestion.md`. Composes `@rag/connector-runtime` and `@rag/index-service`; it adds no core logic.

## Interface

```ts
const ingestion = createIngestion({
  runtime: { cursors, clock, pageSize, maxAttempts }, // RuntimeDeps without the sink and connector
  indexService, // @rag/index-service
  connectorFor: (tenantId) => connectors.get(tenantId), // undefined for an unknown tenant
  tokenFor: (tenantId) => tokens.get(tenantId),
  known: (tenantId) => ids, // optional: pointer ids already indexed, e.g. from the registry
  reapGuard: { maxFraction: 0.5, minDocs: 10 }, // optional; false disables
  warn: (msg, fields) => log.warn(msg, fields), // optional: told when a delete pass is skipped
});
const { emitted, indexed, failed, failures, quarantined } = await ingestion.runOnce("tenant-1");
```

`docId(connectorId, address)` returns the pointer id used for a document.

## Behaviour

- Each changed document is fetched once for its content hash, turned into a pointer (ACL, zone and times from the listing) and applied as an upsert that carries the fetched text, so the index service does not fetch it again.
- First run indexes all documents. A rerun emits none. A new version emits one.
- The connector and the credential are resolved per tenant by `connectorFor` and `tokenFor`. If either returns undefined, `runOnce` throws `IngestionError` `UNKNOWN_TENANT` before touching anything. A resolver must never return one tenant's connector for another tenant.
- A failing document does not stop the run. It is counted in `failed` and listed in `failures` (`{address, error}`); the other documents are indexed and the delete pass still runs. A caller must check `failures`: an empty list is the only full success.
- A failed document is retried on the next runs (the runtime re-lists from the start). After `maxAttempts` runs (default 3) it is quarantined: skipped, and returned in `quarantined` on every run, until a new version or ACL arrives.
- A changed ACL at an unchanged version is a new event and is re-indexed.
- After a run that listed every page from the start (document failures do not prevent this; a connector error does), documents this process indexed earlier, or that `known(tenantId)` returns (read only at this point, so an incomplete listing never calls it), but that are no longer listed get a delete event (tombstone). A throwing `known` rejects the run; the upserts already applied stay.
- Reap guard: a delete pass is skipped, with nothing deleted, when the complete listing is empty and documents are known (`reason: "empty-listing"`), or when at least `minDocs` (10) are known and more than `maxFraction` (50%) of them would be tombstoned (`reason: "too-many"`). The run then returns `reapSkipped: {reason, wouldDelete, known}` and calls `warn("reap skipped", ...)`. `reapGuard: false` turns the guard off, for a deliberate mass delete.
- Counts: `emitted` is events sent to the index (upserts and deletes, including failed ones); `indexed` is events applied as created, updated or deleted; `failed` is rejected events (one per failed document attempt or delete). A failed delete is reported in `failures` and retried on the next full run.
- Other runtime errors (`INVALID_INPUT`, `BAD_CURSOR_LOOP`, connector errors) propagate unchanged.

## Limits

- Delete detection uses an in-memory known set. After a restart it is empty unless the caller supplies `known`; without it, documents deleted while the process was down stay indexed. Ids that `known` returns but the index does not hold are still sent a delete when unlisted (counted in `emitted`); failure reports show the id in place of the address for them.
- A run resumed from a saved mid-scan cursor does not detect deletes; the next full run does.
- A file deleted and re-added at the same version within the runtime's seen-id ttl (24 h) is not re-emitted.
- `runOnce` calls for one tenant are serialised (a second call waits); different tenants run in parallel. The lock is in-process.
- Each attempt on a changed document is one fetch. A document that fails and is retried is fetched again on the retry. The text is held in memory from fetch to index, and the index service verifies it against the pointer hash.

## Test

`pnpm --filter @rag/ingestion test`, `typecheck`, `mutation`. Tests use in-memory databases. Build the dependencies first: core-types, change-cursor, chunker, connector-kit, hybrid-search, pointer-registry, connector-runtime, index-service.
