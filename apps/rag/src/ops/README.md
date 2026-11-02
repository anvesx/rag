# src/ops

| File          | Job                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `gate.ts`     | `createGate`: counts in-flight ingest and search, refuses new work once draining, waits for the rest (plus a 100 ms flush delay).          |
| `health.ts`   | `startHealth`: `/healthz` (up) and `/readyz` (stores answer, not draining; 503 otherwise) on their own port, no auth, nothing else served. |
| `ready.ts`    | `readiness`: the `/readyz` probe; stores answer and the embedder model loads, bounded by the embed-query timeout.                          |
| `shutdown.ts` | `installShutdown`: SIGTERM/SIGINT run `close`, then exit 0; a failure or the force-exit timer exits 1.                                     |
