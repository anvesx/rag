# src

`server.ts` spawns the real built app in demo mode and resolves with its URL once it logs that it is listening. `mcp.ts` speaks MCP streamable HTTP with Playwright's request client: initialize, then a `search` tool call.
