# scale-test

Load test for the RAG MCP search endpoint, in two forms with the same thresholds: under 1% errors and p95 under 500 ms.

## Node runner (runs here, no k6 needed)

`pnpm -r build` first, then `pnpm --filter @rag/scale-test scale:node`.

It spawns the real `apps/rag/dist/bin.js` in demo mode (`RAG_DEMO=1`, `RAG_PORT=0`, temp-dir audit DB and anchor), runs the MCP initialize handshake as `alice:acme`, then ramps connections with [autocannon](https://github.com/mcollina/autocannon) (MIT, pinned) against `tools/call search`. Each stage is checked by `evaluate` in `src/thresholds.ts`; any violation exits 1.

- `SCALE_CONNECTIONS` (default `5,25,50`): connections per stage.
- `SCALE_STAGE_SECONDS` (default `10`): seconds per stage.

autocannon reports no p95, so the runner checks p97.5. That is stricter than p95: passing it implies p95 passes.

## k6 script

k6 is AGPL-3.0, so it runs as an external binary and is never imported or bundled.

Start the app, then `RAG_URL=http://127.0.0.1:3000/mcp RAG_TOKEN=<token> pnpm --filter @rag/scale-test scale`. Load: ramp to 50 virtual users over 30 seconds, hold 1 minute, ramp down. k6 exits non-zero when a threshold fails.

`pnpm test` checks that the k6 script keeps both thresholds and unit-tests the Node evaluation.

## Real k6 run

`SCALE_ENGINE=k6 K6_RAMP=10s K6_HOLD=30s pnpm --filter @rag/scale-test scale:node` starts the built app, then runs `src/search.js` under k6 against it. `setup()` does the MCP handshake once and shares the session. Defaults without the env vars are a 30s ramp and a 1m hold at 50 VUs. Thresholds: failed rate under 1% and p95 under 500 ms.

Last result (k6 v2.3.0, 10s ramp, 30s hold, 50 VUs): 158,401 requests, 0 failed, p95 18.11 ms, 3,167 req/s.
