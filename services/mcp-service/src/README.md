# src

- `start.ts` validates options and dispatches to a transport; `build.ts` makes one `McpServer` with
  the `search` tool registered; `stdio.ts` wraps the SDK stdio transport; `errors.ts` holds the typed error.
- `http/` holds the Streamable HTTP server (`server.ts`), session registry (`sessions.ts`) and
  bounded JSON body reader (`body.ts`).
