# @rag/integration

Cross-package integration suite. It wires the real packages (pointer-registry, change-cursor, connector-kit,
connector-runtime, ingestion, index-service, hybrid-search, query-service, governance, audit-service, retrieval)
without the app and checks the behaviour that only shows across packages. Spec: `docs/specs/tool/integration.md`.

## Run

```sh
pnpm -r build
pnpm integration   # or: pnpm --filter @rag/integration test
```

Dependencies must be built first: the suite imports each package's `dist`.

## What it covers

- `tests/search`: ingest then search on real SQLite; user, group and tenant ACL; ACL tightened or widened at the source.
- `tests/live`: the real stack with the connector live ACL (`stack.searchLive`) over files on disk: allow, deny, source error, timeout (typed `LIVE_ACL`, fail closed) and a revocation at the source with no re-ingest.
- `tests/lifecycle`: delete tombstones, audit chain verify and tamper detection, retrieval over MCP, restart, connector failure.

## Limits

Embeddings are a constant vector, so the vector side matches every visible doc and only rank (keyword first) separates
them. Tests that need an exact result set therefore use docs that all match, or a `limit`. Time is injected, so it does not test
cursor expiry. Tests write only under `os.tmpdir()` and clean up. The app's auth, bin and config are not exercised.
