# Source layout

- `schema.ts` owns MCP input validation and the default limit.
- `filter.ts` drops tombstoned and cross-tenant pointers.
- `format.ts` projects internal pointers onto the safe public result shape.
- `register.ts` registers the tool and adapts dependencies to MCP results.
- `index.ts` exposes the supported package API.

All runtime imports use ESM `.js` suffixes. Authentication remains outside this package: callers
derive a principal from MCP request metadata through `principalFor`.
