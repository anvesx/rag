# src

| File       | Job                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------ |
| `app.ts`   | `createRagApp`: opens stores, bounds dependencies, serves MCP and health, drains on close. |
| `types.ts` | `RagDeps`, `RagApp`, `SearchInput`.                                                        |
| `config/`  | Env parsing (`readEnv`, `readOps`) and the demo dependencies.                              |
| `auth/`    | Signed expiring bearer tokens, token policy, auth mode and the audit key rule.             |
| `cli/`     | Process wiring: source selection, per-user tokens, `mint-token`, `startFromEnv`.           |
| `ops/`     | In-flight gate, `/healthz` and `/readyz`, signal handling with a force-exit timer.         |
| `wire/`    | The ingest/search/audit pipeline over the opened stores.                                   |
| `live/`    | Connector-based live ACL verifier and the audited search that uses it (`userTokenFor`).    |
| `runtime/` | Store opening and closing, timeouts, ingestion's known set, the default logger.            |
| `bin.ts`   | Process entry: `mint-token` subcommand, or serve, then graceful shutdown.                  |
| `index.ts` | Public exports.                                                                            |
