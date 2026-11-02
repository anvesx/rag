# src/live

| File        | Job                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search.ts` | `liveSearch`: audited search with the connector live ACL (`createConnectorLiveAcl` from `@rag/retrieval`); a failed check rejects with `LIVE_ACL`. |

Used only when `userTokenFor` is set. Verdict rules are documented in `modules/retrieval/src/live/README.md`.
