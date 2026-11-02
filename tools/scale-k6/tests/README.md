# tests

`node --test`, no mocks: `rank-server.test.mjs` seeds 300 docs in a real SQLite file and calls the wrapper over a real socket; `outcome.test.mjs` runs real child processes (exit 0, exit 99, killed by SIGKILL, missing binary) through `exitCode`.
