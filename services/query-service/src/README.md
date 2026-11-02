# Source layout

- `errors.ts` defines `QueryError` and its codes.
- `request.ts` holds the public types and input validation.
- `service.ts` wires the index, registry and optional live ACL into `search` and `searchLive`.
- `paging/` pages the index and runs the live ACL check.
- `index.ts` exposes the supported package API.

All runtime imports use ESM `.js` suffixes.
