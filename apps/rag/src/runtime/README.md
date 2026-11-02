# src/runtime

| File          | Job                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `stores.ts`   | `openStores`: registry, search index, audit chain and cursor store (disk under `dataDir`, else memory); `probe` and `close` of every handle. |
| `timeouts.ts` | `withTimeout`, `bounded`: time limits on embed, embedQuery, fetchText and connector.list; `TimeoutError`.                                    |
| `fetch.ts`    | `textFetcher`: `deps.fetchText`, or the tenant connector's `fetch` with the tenant credential when omitted.                                  |
| `known.ts`    | `liveIds`: ids of a tenant's live pointers (of one `source` if given), paged with `afterId`; seeds `IngestionDeps.known`.                    |
| `logger.ts`   | `defaultLogger`: one JSON line per call on stderr.                                                                                           |
