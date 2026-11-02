# src/http

Streamable HTTP transport built on the SDK's `StreamableHTTPServerTransport`; this folder only does
routing, authentication, session ownership and body limits.

- `server.ts`: node `http` server, route `/mcp`, status mapping, graceful close.
- `sessions.ts`: one `McpServer` + transport per session, pinned to the principal that opened it; enforces the caps and idle expiry.
- `limits.ts`: session limit defaults, validation and the injectable `Timers`.
- `guard.ts`: Host/Origin allow-lists (DNS-rebinding defence).
- `body.ts`: JSON body reader capped at 1 MiB.
