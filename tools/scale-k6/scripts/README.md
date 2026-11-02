# scripts

k6 scripts (plain JavaScript run by the k6 binary, not by Node).

- `rank.js`: search at a fixed arrival rate; needs `BASE` and `QUERIES` (a JSON file of queries) in the environment.
- `thresholds.js`: the p95, error-rate, check-rate and dropped-iteration limits.

`bin/run.mjs` supplies the environment. `RATE` and `DURATION` override the defaults.
