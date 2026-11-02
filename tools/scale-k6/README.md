# @rag/scale-k6

Scale test for the rank search path, driven by Grafana k6. k6 is AGPL-3.0, so it stays a separate binary on the developer's machine: nothing here imports it, ships it or links it. Without `k6` on the PATH the runner stops with an error. Moved from company-brain's `tools/scale-k6` (its ADR 0006), together with `features/rank`; the catalog half stayed there with the connections app.

`scripts/rank.js` is an open-loop `constant-arrival-rate` scenario: `GET /search` against `features/rank` holding 10,000 docs. Requests arrive on schedule even if earlier ones are slow, so a backlog shows up as latency or as `dropped_iterations`, not as a quietly lower rate. `@rag/rank` is a library, so `src/rank-server.mjs` puts a thin HTTP handler on `RankIndex.search`. The corpus and the query stream are the ones from `features/rank/scripts/bench`. The index is a real SQLite file, opened with a random per-process key that is never written to disk.

## Run

```sh
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@rag/rank
pnpm --filter @rag/scale-k6 scale        # --docs N changes the corpus
RATE=20 DURATION=60s k6 run ...          # the script reads RATE and DURATION from the environment
```

Exit code 0 means every threshold held, 99 means a threshold was crossed, 1 means k6 did not start or was killed by a signal.

## Thresholds as code

`scripts/thresholds.js`: `p(95)` latency under 100 ms, `http_req_failed` under 1 percent, `checks` over 99 percent (status 200 and the body has the right shape), and `dropped_iterations` equal to 0.

## Reference runs

Measured in company-brain on 2026-11-02, not re-run after the move. Apple M1, 8 logical cores, 16 GiB, Node v26.0.0, k6 v2.3.0, 10 queries per second for 30 s (301 requests), machine also busy (load average 3 to 6). Eighteen runs: p95 about 67 ms to 99 ms, none failed, none dropped. On a loaded laptop the 100 ms limit is tight; run it on a quiet machine or in CI. Rank saturates near 37 queries per second (see `features/rank/scripts/bench`). At `RATE=80 DURATION=10s` the thresholds fail as intended.

## Layout

- `bin/`: `run.mjs` starts the server, runs k6 with `--summary-export` into `reports/` (ignored by version control), stops the server. See [bin](bin/README.md).
- `src/`: rank HTTP wrapper, server launcher, host description. See [src](src/README.md).
- `scripts/`: the k6 script and thresholds. See [scripts](scripts/README.md).
- `tests/`: `node --test` checks of the wrapper and the exit-code helper.

## Not covered

- Writes: indexing under load.
- Corpora above 10,000 docs, and any soak, spike or stress profile.
- Rank is measured over a single-threaded wrapper: the library is synchronous, so a deployed server may differ.
- No CI job: k6 is not installed on the runners.
