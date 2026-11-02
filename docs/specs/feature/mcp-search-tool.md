# Spec: mcp-search-tool

Ticket: #37   Tier: feature   Milestone: M0   Design cards: llm.mcp

## Purpose
Register one MCP tool, `search`, on any MCP server. It returns pointers only: the agent fetches text itself.
## Reuse decision
`@modelcontextprotocol/sdk@1.32.2` (stable v1) with `zod@4.6.7` input schema. The SDK's in-memory
transport is used in tests, so no network is needed.
## Public interface
```ts
export type SearchFn = (q: { query: string; limit: number; principal: Principal }) => Promise<Pointer[]>;
export function registerSearchTool(server: McpServer, deps: { search: SearchFn; principalFor: (extra: unknown) => Principal }): void;
```
## Behaviour
1. Tool `search` takes `{ query: string (1..2000), limit?: int 1..50, default 10 }`.
2. Result content is JSON text of `{ results: [{ id, source, address, title, version, zone }] }`. No body text field ever.
3. The principal comes from `principalFor`, never from tool input.
4. `search` throwing returns an MCP error result (`isError: true`) with a safe message, not a crash.
5. Over-long query or bad limit is rejected by schema before `search` runs.
## Acceptance tests (first)
unit (schema bounds), integration (client and server joined by in-memory transport: list tools, call, empty result, error result), mutation >= 80.
## Layout
`features/mcp-search-tool/src/{register.ts,schema.ts,format.ts,index.ts}`.
## Out of scope
Auth, other tools, HTTP transport.
