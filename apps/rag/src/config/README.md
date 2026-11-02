# src/config

| File       | Job                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`   | `readEnv`: port, bind host, allowed hosts and origins, data dir, signing secret, folder root, `RAG_CONNECTOR` (folder, github or drive), tenant. Throws when `RAG_DATA_DIR` is set without `RAG_AUTH_SECRET`. |
| `ops.ts`   | `readOps`: timeouts (`RAG_EMBED_TIMEOUT_MS`, `RAG_EMBED_QUERY_TIMEOUT_MS`, `RAG_FETCH_TIMEOUT_MS`, `RAG_LIST_TIMEOUT_MS`), drain, force-exit and health port.                                                 |
| `demo.ts`  | `demoDeps`: the demo connector (tenant acme), toy embeddings, `embedText`.                                                                                                                                    |
| `index.ts` | Barrel for the above.                                                                                                                                                                                         |

The audit DB and anchor log default to `audit.db` and `anchors.log` inside `RAG_DATA_DIR`.
