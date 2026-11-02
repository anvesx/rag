# @rag/mcp-search-tool

Registers one MCP tool named `search` on an SDK `McpServer`. The tool accepts a query and optional
limit, delegates retrieval, and returns pointer metadata as JSON text. It never returns document
bodies, tenant metadata, hashes, ACLs, or timestamps.

## Interface

`registerSearchTool(server, { search, principalFor, logger? })` mutates the supplied server by registering
the tool. `search` receives `{ query, limit, principal }`. `principalFor` derives the principal from
SDK request metadata; callers cannot provide a principal in tool input.

```ts
import { registerSearchTool } from "@rag/mcp-search-tool";

registerSearchTool(server, {
  principalFor: (extra) => principalFromSession(extra),
  search: ({ query, limit, principal }) => index.search(query, limit, principal),
});
```

## Behaviour and limits

Queries contain 1–2,000 characters. Limits are integers from 1–50 and default to 10. Successful
calls return one text content item containing `{"results":[...]}`. Pointers with `deletedAt` set, or whose `tenantId` differs from the principal's, are dropped before
formatting (defence in depth; the backend should already filter them). Dependency failures become a
safe MCP error result and do not expose the original error; the cause is passed to the optional
`logger(cause)` (a throwing logger is ignored). There is no default logger and no console output. Schema failures occur before either
dependency runs.

This package does not implement authentication, retrieval, body fetching, other tools, or HTTP
transport. Search latency and concurrency are determined by the injected `search` function.

## Verification

Run `pnpm test`, `pnpm typecheck`, and `pnpm mutation` from this directory. Integration tests use
the SDK's linked in-memory transports and make no network calls.
