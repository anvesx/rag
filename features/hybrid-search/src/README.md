# Source map

- `index.ts` owns the public API.
- `rrf.ts` fuses ranked identifiers.
- `escape.ts` makes user text literal for FTS5.
- `errors.ts` defines typed failures.
- `search/` owns SQLite persistence and retrieval (`validate.ts` holds `MAX_WINDOW` and the limit and offset rules).
