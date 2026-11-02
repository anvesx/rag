# src

| File          | Job                                                                   |
| ------------- | --------------------------------------------------------------------- |
| `change.ts`   | `isUnchanged`: field-by-field equality, ACL lists as sorted sets.     |
| `errors.ts`   | `RegistryError` with code `INVALID` or `TENANT_REQUIRED`.             |
| `schema.ts`   | Table DDL, column list, every SQL string, row-to-pointer mapping.     |
| `registry.ts` | `createRegistry`: the four operations plus `close`, on `node:sqlite`. |
| `index.ts`    | Public exports.                                                       |
