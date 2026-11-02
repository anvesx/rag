# src

One file, one job. Dependencies flow downward: `chain` -> `store`, `canonical` -> `triggers`, `errors`.

| File           | Job                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `chain.ts`     | Public API: `createAuditChain`, `append`, `head`, `verify` (optional anchor), `list`. Also re-exports types and `AuditError`. |
| `canonical.ts` | Validates an event, makes its canonical bytes (RFC 8785) and computes `sha256(prev + canonical)`.                             |
| `store.ts`     | Opens the SQLite file, creates the table, runs the append transaction, reads rows.                                            |
| `triggers.ts`  | Installs the triggers that abort any UPDATE or DELETE on the table.                                                           |
| `errors.ts`    | `AuditError` with code `INVALID` (bad input) or `STORAGE` (database failure).                                                 |
