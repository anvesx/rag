# bin

- `run.mjs [--docs 10000]`: prints the host, starts the rank server, runs the k6 script with `--summary-export` into `reports/` (ignored by version control, kept after the run), stops the server, exits non-zero when the k6 run fails (99 when a threshold fails; a k6 killed by a signal or not started counts as 1).
- `outcome.mjs`: `exitCode(spawnResult)` and `reportPath(script)`, the two pure helpers `run.mjs` uses.
