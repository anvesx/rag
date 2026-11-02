# change-cursor/src

Incremental sync state. The store issues and validates opaque cursors, and `diffListing` reports what changed between two listings.

| File        | Job                                                                            |
| ----------- | ------------------------------------------------------------------------------ |
| `schema.ts` | SQL schema, limits (`CURSOR_MAX_CHARS`, `DEFAULT_TTL_MS`) and input validators |
| `diff.ts`   | `diffListing`: compares a new listing to the previous one                      |
| `store.ts`  | `createCursorStore`: persists cursor state in `node:sqlite`                    |
| `errors.ts` | `CursorError` with codes `INVALID_INPUT` and `CURSOR_TOO_LARGE`                |
| `index.ts`  | Public exports                                                                 |
