# src/cli

| File             | Job                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serve.ts`       | `startFromEnv`: reads env, enforces the auth mode, picks the source, starts the app and ingests each tenant.                                                         |
| `sources.ts`     | `sourceFor`: the `connectorFromEnv` connector as tenant `RAG_TENANT`, otherwise the demo. Embeds with the real 384-D model; only `RAG_DEMO=1` uses the toy embedder. |
| `connectors.ts`  | `connectorFromEnv`: `RAG_CONNECTOR=folder\|github\|drive` and each one's required env; a missing value throws a one-line message (exit 1, no stack).                 |
| `user-tokens.ts` | `userTokensFor`: `RAG_USER_TOKENS` JSON `{"tenant:user": credential}` for connectors that enforce per-user tokens.                                                   |
| `mint-token.ts`  | `rag mint-token --user U --tenant T [--groups a,b] [--ttl SECONDS] [--kid K]`; never exceeds `RAG_TOKEN_MAX_TTL_SECONDS`.                                            |
