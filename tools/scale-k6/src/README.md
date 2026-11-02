# src

- `rank-server.mjs`: HTTP wrapper over `RankIndex` (`GET /search`, `GET /healthz`). Seeds a fresh SQLite file with the bench corpus, listens on loopback, returns a stop function. Run directly: `node rank-server.mjs <docs> <port>`.
- `servers.mjs`: starts the rank wrapper as a child process and waits for it to answer.
- `env.mjs`: prints the CPU, memory, load, Node and k6 versions a run is measured on.
