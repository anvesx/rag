# Spec: integration suite

Ticket: n/a   Tier: tool   Milestone: M5

Design cards: none

## Purpose
`@rag/integration` (tools/integration) wires the real packages together without the app and proves the
cross-package behaviour the unit suites cannot: pointer-registry, change-cursor, connector-kit,
connector-runtime, ingestion, index-service, hybrid-search, query-service, governance, audit-chain and
audit-service, plus retrieval over a real MCP client. It has no product logic and publishes nothing.

## Reuse decision
vitest 5 (already in the repo), `node:sqlite` files in an OS temp dir, `@modelcontextprotocol/sdk@1.32.2` (same pin as
apps/rag) only for the retrieval test. No new third-party library.
Tier rule change: structure-lint let a tool depend on no product tier, so a suite that imports them could not
declare its dependencies. `tool` may now depend on feature, service and module; nothing may depend on a tool.

## Public interface
`openStack(dir, source, opts?) -> Stack` in `src/stack.ts`, and `createSource(docs) -> Source` in `src/source.ts`.
- `Stack`: `ingest(tenantId)`, `search(principal, query, limit?)`, `verify(tenantId)`, `checkpoint(tenantId)`, `registry`,
  `cursors`, `auditDbPath`, `close()`.
- `Source`: a mutable `Connector`: `put(doc)`, `remove(address)`, `failFetch(address, on)`, `docs()`.
These are test fixtures, not a contract for other packages.

## Behaviour
1. One `openStack` call opens registry, search index, cursor store, audit chain and anchor file under `dir`. Reopening the same `dir` resumes.
2. The stack uses only public package exports. It adds no logic beyond the app's own composition.
3. Every test writes only under its own `mkdtemp` directory and removes it afterwards.

## Acceptance tests (written first)
- search: ingest then search returns the visible docs, real SQLite on disk.
- search: user deny, group allow, and no cross-tenant leak in both directions.
- search: ACL tightened at the source is reflected after re-ingest, and widened ACL too.
- lifecycle: a doc deleted at the source is tombstoned and leaves search.
- lifecycle: the audit chain verifies after N searches, detects an edited row, and detects truncation after a checkpoint.
- live: real stack with connector live ACL (retrieval's createConnectorLiveAcl) (allow, deny, source error, timeout fails closed with LIVE_ACL, revocation without re-ingest).
- lifecycle: retrieval over MCP writes one verifiable audit row per search.
- lifecycle: a reopened `dir` keeps the index and the cursor; nothing is re-emitted; deletes made while down are tombstoned.
- lifecycle: a doc whose fetch fails is reported and quarantined without blocking others, and recovers when it heals.
- mutation: not applicable (no product logic).

## Layout
`tools/integration/{package.json,tsconfig.json,vitest.config.ts,README.md,src/{stack,source,fixtures,index}.ts,tests/{search,lifecycle}/}`.

## Out of scope
The MCP-over-HTTP wire protocol beyond one search call, the app's auth and bin, embeddings quality, load.
