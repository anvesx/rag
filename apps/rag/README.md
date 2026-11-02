# @rag/app

The runnable RAG server. Spec: `docs/specs/app/rag.md`. It composes ingestion, governed search and the MCP server; it adds no core logic.

```ts
const app = await createRagApp({
  connectorFor: (tenantId) => connectors.get(tenantId), // undefined for an unknown tenant
  tokenFor: (tenantId) => tokens.get(tenantId),
  cursors, // optional: defaults to a file in dataDir, else in memory
  dataDir, // optional: registry, search index and cursors on disk
  logger, // optional: { error, warn, info }; default JSON lines on stderr
  clock,
  embed,
  embedQuery,
  fetchText, // optional: default reads through the tenant's connector with the tenant credential
  userTokenFor, // optional: turns on the live ACL (see below)
  liveAclTimeoutMs, // optional: how long the live check may take; default 2000 (query-service)
  principalFor,
  auditDbPath,
  anchorPath,
  transport: "http",
  port: 0,
});
const { failures, quarantined } = await app.ingest("tenant-1"); // tenant connector -> index; check failures
await app.search({ query, principal }); // audited, same path as MCP
await app.verify("tenant-1"); // audit chain check
await app.checkpoint("tenant-1"); // anchor, so truncation is detectable
await app.close(); // idempotent, frees the port
```

## Behaviour

- Every search, whether over MCP or `app.search`, goes through governance and writes one audit row.
- ACL, tenant and tombstone rules come from the query service. Unauthenticated HTTP gets `401`.
- With `dataDir` (env `RAG_DATA_DIR`) the registry, search index, cursor store, audit DB and anchor log are files there, so ingested docs stay searchable and are not re-emitted after a restart. Without it they are in memory.
- MCP search failures are logged through `logger` (cause name and message only, never query text, principal or token); the client still sees only `Search failed`.
- Vector size is measured by embedding one probe text at startup unless `dimension` is given.

## Live ACL

Set `userTokenFor(principal)` (the user's own credential at the source) and every search re-checks each hit at the source: the connector fetches the document with the user's token (`createConnectorLiveAcl` from `@rag/retrieval`). A read that succeeds keeps the hit; `NOT_FOUND` drops it; any other error, a missing token, an unknown tenant or a timeout fails closed. If nothing can be verified, `app.search` rejects with `RetrievalError` code `LIVE_ACL` and MCP clients see `Search failed`; one failure audit row is written (count 0). Successful live searches write the same audit rows as governed ones, built through `@rag/retrieval`. Without `userTokenFor`, search uses the cached ACL and governance as before.

Cost: the check fetches the full document for each hit. Fine for a handful of hits per search, expensive for large documents.

## Run

Local demo: `RAG_DEMO=1 RAG_PORT=3000 node dist/bin.js`. Prints `rag listening on http://HOST:PORT/mcp` and `rag health on http://HOST:HEALTHPORT`.

Folder mode: `RAG_FOLDER_ROOT=/docs RAG_TENANT=acme RAG_AUTH_SECRET=... RAG_AUDIT_KEY=... node dist/bin.js` serves a directory as one tenant. Each document's ACL is in a `<doc>.acl.json` sidecar; a document without one is denied to everyone. Search embeds with the real 384-D model (`@rag/embedder`), downloaded on first use. Only `RAG_DEMO=1` uses the toy embedder. Real connectors: `RAG_CONNECTOR=github` (needs `GITHUB_TOKEN`, `RAG_GITHUB_REPO=owner/repo`) or `drive` (needs `DRIVE_ACCESS_TOKEN`); both need `RAG_TENANT`. A missing value exits 1 with one line. A connector that enforces per-user tokens needs `RAG_USER_TOKENS` (JSON file `{"tenant:user": "credential"}`, mode 600: group or world readable files are refused); that wires `userTokenFor` and turns on the live ACL.

| Variable                                                                                            | Meaning                                                                                      |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `RAG_PORT`                                                                                          | MCP port, default 3000.                                                                      |
| `RAG_HOST`                                                                                          | Bind address, default loopback. Use `0.0.0.0` in a container.                                |
| `RAG_ALLOWED_HOSTS`, `RAG_ALLOWED_ORIGINS`                                                          | Comma lists. Host values include the port. Default: loopback on the bound port.              |
| `RAG_DATA_DIR`                                                                                      | Registry, index, cursors, `audit.db` and `anchors.log` on disk. Requires `RAG_AUTH_SECRET`.  |
| `RAG_AUDIT_DB`, `RAG_ANCHOR`                                                                        | Override the audit paths (default under the data dir).                                       |
| `RAG_AUTH_SECRET`, `RAG_AUDIT_KEY`                                                                  | Token signing secret and audit key, each at least 32 characters.                             |
| `RAG_AUTH_KEYS`                                                                                     | JSON `{"kid": "secret"}`: extra verification keys for rotation.                              |
| `RAG_TOKEN_MAX_TTL_SECONDS`                                                                         | Longest lifetime a token may claim, default 86400.                                           |
| `RAG_FOLDER_ROOT`, `RAG_TENANT`, `RAG_USER_TOKENS`                                                  | Folder mode (see above).                                                                     |
| `RAG_CONNECTOR`                                                                                     | `folder`, `github` or `drive`. Needs `RAG_TENANT`; github and drive apply `RAG_USER_TOKENS`. |
| `GITHUB_TOKEN`, `RAG_GITHUB_REPO`, `RAG_GITHUB_API_URL`                                             | github: index token, `owner/repo`, optional API base URL (tests, GitHub Enterprise).         |
| `DRIVE_ACCESS_TOKEN`, `RAG_DRIVE_ROOT_URL`                                                          | drive: index token, optional API root URL.                                                   |
| `RAG_EMBEDDER_CACHE_DIR`                                                                            | Where the embedding model is cached (default: the embedder package's).                       |
| `RAG_EMBED_TIMEOUT_MS`, `RAG_EMBED_QUERY_TIMEOUT_MS`, `RAG_FETCH_TIMEOUT_MS`, `RAG_LIST_TIMEOUT_MS` | Time limits (defaults 30000, 5000, 30000, 30000).                                            |
| `RAG_DRAIN_MS`, `RAG_FORCE_EXIT_MS`                                                                 | Shutdown: wait for in-flight work (10000), then exit 1 regardless (20000).                   |
| `RAG_HEALTH_PORT`                                                                                   | Health port, default MCP port + 1 (0 = ephemeral).                                           |

Shutdown (SIGTERM/SIGINT): new ingest and search are refused, in-flight ones finish (up to `RAG_DRAIN_MS`), then the MCP server, health server and every SQLite handle close. `/readyz` turns 503 at once. `/healthz` and `/readyz` are on the health port because the MCP server answers only `/mcp`.

Container: `docker compose up --build` from this folder (see `docker-compose.yml`; set `RAG_AUTH_SECRET` and `RAG_AUDIT_KEY` in the environment first). The compose file keeps data in a named volume.

## Auth

Without `RAG_AUTH_SECRET` the process refuses to start unless `RAG_DEMO=1` and `RAG_HOST` is loopback; only then is the forgeable unsigned `Bearer alice:acme` accepted.

Bearer token, legacy form: `<user>:<tenant>:<exp>:<hmac-sha256-hex(secret, "user:tenant:exp")>`. Extended form: `<user>:<tenant>:<exp>:<groups>:<kid>:<sig>`, signed over `user:tenant:exp:groups:kid`; `groups` is comma separated and `kid` optional (empty when absent). Groups come only from the signed token. `exp` is epoch seconds, checked in constant time. A missing or bad signature, an unknown kid, or a lifetime past the maximum is unauthenticated. A correctly signed token at or past `exp` throws `TokenExpiredError` (`TOKEN_EXPIRED`); MCP clients see the same 401.

Mint: `RAG_AUTH_SECRET=... node dist/bin.js mint-token --user alice --tenant acme [--groups eng,ops] [--ttl 3600] [--kid k2]`. In code: `mintToken(secret, user, tenant, { ttlSeconds?, groups?, kid?, maxLifetimeSeconds?, now? })`; default lifetime one hour. Rotation: add the new secret to `RAG_AUTH_KEYS` under a kid, mint with `--kid`, retire the old secret. There is no revocation before `exp` except rotating keys.

Audit key: `RAG_AUDIT_KEY` (at least 32 characters) is required whenever `RAG_AUTH_SECRET` or `RAG_DATA_DIR` is set; `bin.ts` prints the reason and exits 1 without it. Only in pure demo mode (neither set) a missing key falls back to the public constant `demo-only-audit-key`, with a warning on stderr.

## Limits

- `@rag/retrieval` cannot take an injected search function, so the app starts `@rag/mcp-service` directly. Governed search (no live ACL) uses governance, whose sync query path cannot run a live verifier; live search composes retrieval's `toOutcomeFn`, `auditedOutcome` and `toSearchFn` instead.
- `truncated` (candidate cap hit) is not exposed by `app.search`, which returns pointers only.
- `bin.ts` wires `userTokenFor` only through `RAG_USER_TOKENS`, and only for connectors that enforce user tokens. The folder connector does not.
- Ingestion runs once at start, not on a schedule.
- After a restart with `dataDir`, the first full-listing run seeds ingestion's known set from the registry's live pointers written by the tenant's own connector (`pointer.source` equals the connector id; `runtime/known.ts`, paged with `afterId`), so documents deleted at source while the app was down are tombstoned. Without `dataDir` the registry starts empty, so there is nothing to seed. A run that does not list everything (connector error, resume from a saved cursor) tombstones nothing. A complete but empty listing, or one that would tombstone more than half of 10 or more known documents, is not reaped: the run returns `reapSkipped` and the app logs `reap skipped` at warn level (see `@rag/ingestion`).
- `dataDir` must be reused with the same embedding dimension (384 now). A different one makes startup throw `IndexDimensionError` and leaves the index untouched; use a fresh directory and re-ingest.
- `/readyz` is 503 until the embedding model loads. `RAG_EMBEDDER_OFFLINE=1` only skips the model-dependent tests (as in `@rag/embedder`); the app has no offline switch.

## Test

`pnpm test`, `pnpm typecheck`, `pnpm mutation` from this folder. Build the dependencies first.
