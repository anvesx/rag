# Source layout

- `adapter.ts` `toOutcomeFn`: embeds the query, calls query-service `searchLive`, returns a typed `Outcome` (`ok` with `truncated`, or `LIVE_ACL` failure). `toSearchFn` turns an outcome function into the pointer-only function the MCP tool expects (a failure rejects).
- `audit.ts` `auditedOutcome` and `auditedSearch`: write one keyed audit row before returning results, fail closed; a `LIVE_ACL` failure writes no row.
- `errors.ts` `RetrievalError` with codes `AUDIT`, `CONFIG` and `LIVE_ACL`.
- `retrieval.ts` builds the query service, wraps it in the audit, starts the MCP server and returns `{ close, port, search }`.
- `live/` `createConnectorLiveAcl`: a `LiveAcl` that re-checks hits at the source with the user's token (see its README).
- `index.ts` exposes the supported package API.

All runtime imports use ESM `.js` suffixes.
