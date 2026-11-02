# tests/support

| File         | Job                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `replay.ts`  | `startReplay`: a real local HTTP server that answers each pathname, per caller token, so the real GitHub and Drive SDKs run their request path (base URL overrides). |
| `sources.ts` | `replayGithub`, `replayDrive`: one private repo and one Drive file shared with alice and bob; only the indexer and alice can read, bob's own token is revoked (404). |
