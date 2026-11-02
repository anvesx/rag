# src

- `search.js`: the k6 scenario. Plain JavaScript because k6 runs its own runtime, not Node.
- `run.ts`: the Node runner (autocannon ramp, exit 1 on a violated threshold).
- `thresholds.ts`: pure threshold evaluation shared by the runner and its unit tests.
- `server.ts`: spawns the built app in demo mode.
- `mcp.ts`: MCP headers, search body and the initialize handshake.
