# @rag/mcp-service

Runs the `search` MCP tool from `@rag/mcp-search-tool` over real MCP transports, using the
`@modelcontextprotocol/sdk` stdio and Streamable HTTP transports (nothing hand-rolled).

```ts
import { startMcpServer } from "@rag/mcp-service";

const server = await startMcpServer({
  transport: "http", // or "stdio"
  port: 0, // http only; 0 = ephemeral, read server.port
  search: ({ query, limit, principal }) => index.search(query, limit, principal),
  principalFor: (extra) => principalFromAuthHeader(extra), // throws when unauthenticated
});
await server.close();
```

## Behaviour

- The principal always comes from `principalFor(extra)`, never from tool input. Over HTTP, `extra.requestInfo.headers`
  carries the request headers.
- HTTP: endpoint `POST/GET/DELETE /mcp` on 127.0.0.1 (or `host`). A request whose `principalFor` throws gets
  `401` before the SDK sees it. A session id used by a different principal gets `403`; unknown id `404`;
  non-initialize request without a session `400`; invalid JSON `400`; body over 1 MiB `413`; other paths `404`;
  a disallowed `Host`/`Origin` `403`; too many sessions `429` (body `Too many sessions`, no principal detail).
- stdio: one connection on `stdin`/`stdout` (injectable). `principalFor` has no headers there, so resolve from
  process context (env, config).
- `close()` is idempotent. HTTP close ends every session, closes streams, and frees the port.
- Invalid options throw `McpServiceError` with code `INVALID_CONFIG`.

## HTTP hardening options (all optional)

| Option                    | Default                                                               | Meaning                                                                                |
| ------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `maxSessions`             | 1000                                                                  | Open or initializing sessions across all principals; over it, `initialize` gets `429`. |
| `maxSessionsPerPrincipal` | 20                                                                    | Same, per (tenantId, principal id).                                                    |
| `idleTimeoutMs`           | 1800000 (30 min)                                                      | A session with no request for this long is closed (server and transport).              |
| `timers`                  | real timers                                                           | `{ setTimeout, clearTimeout }`, injected so tests can use a fake clock.                |
| `allowedHosts`            | `localhost:PORT`, `127.0.0.1:PORT`, `[::1]:PORT`                      | Exact `Host` header values (with port). Empty list is `INVALID_CONFIG`.                |
| `allowedOrigins`          | `http://localhost:PORT`, `http://127.0.0.1:PORT`, `http://[::1]:PORT` | A request with no `Origin` is allowed; one with an unlisted `Origin` gets `403`.       |

Limits are positive integers or `INVALID_CONFIG`. `PORT` is the bound port, so `port: 0` works. If you bind a
non-loopback `host` or sit behind a proxy, set `allowedHosts`/`allowedOrigins` to the names clients really use.
Host and Origin are checked before authentication and again by the SDK transport
(`enableDnsRebindingProtection`, `allowedHosts`, `allowedOrigins`; the SDK marks these deprecated in favour of
middleware, which this service is).
The idle clock restarts on every request carrying the session id; a client holding only an idle SSE stream is
expired after `idleTimeoutMs` and must re-initialize.

## Limits

No TLS, CORS or request-rate limiting; put it behind a gateway. Sessions are in-memory and per process.

## Verification

`pnpm test` builds the package, spawns a real stdio child, and starts real HTTP servers on ephemeral ports.
`pnpm typecheck`, `pnpm mutation` (runs Stryker in place; see `stryker.config.json`).
