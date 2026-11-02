# @rag/acl-filter

Turns a principal into a SQL predicate and an equivalent pure check. Deny by default.
Spec: `docs/specs/feature/acl-filter.md` (ticket #35, design card sec.acl).

## What it does

A row is visible to a principal only if both hold:

1. `row.tenant_id` equals the principal's `tenantId`, and
2. the principal's `id` is in the row's `allow_users`, or any of the principal's `groups` is in `allow_groups`.

Empty lists grant nobody. A principal with no groups and an unlisted id is denied. A NULL ACL column is denied. Comparison is exact: case sensitive, no wildcards, `%` and `_` are ordinary characters. A group id never matches a user entry and the reverse.

## Interface

```ts
isAllowed(p: Principal, acl: Acl, rowTenant: string): boolean
allowClause(p: Principal): { sql: string; params: unknown[] }
```

Types come from `@anvesx/core-types`. `allowClause` expects columns `tenant_id` (text), `allow_users` and `allow_groups` (JSON arrays of strings stored as text).

## Why the SQL is injection-proof

The SQL text is one constant string. Tenant, user id and the group list travel only as bound params, in the order `[tenantId, id, JSON(groups)]`. The group list is a single JSON param read with `json_each`, so a principal with 1000 groups uses 3 bound variables, not 1002. A test asserts that hostile ids (quotes, `;`, `%`, unicode) produce byte-identical SQL.

## Usage

```ts
import { DatabaseSync } from "node:sqlite";
import { allowClause } from "@rag/acl-filter";

const { sql, params } = allowClause({ id: "alice", tenantId: "t1", groups: ["eng"] });
const rows = db.prepare(`SELECT * FROM docs WHERE ${sql}`).all(...params);
```

If the query has other bound params, put the clause's params in the position its `?` marks occupy. The clause is a self-contained parenthesised expression, safe to join with `AND`.

## Limits

- Needs SQLite JSON1 (`json_each`); built in to `node:sqlite`. Other databases need their own clause.
- Principal groups are capped at 1000 by `PrincipalSchema`; the filter itself has no cap.
- Does not validate inputs. Parse with `PrincipalSchema` and `AclSchema` first.
- Out of scope: Cedar policies, zone rules, group lookup.

## Test

```
pnpm test        # truth table, injection, property (1000 runs), integration
pnpm typecheck
pnpm mutation    # Stryker, break threshold 80
```

The property test creates a real in-memory `node:sqlite` table per run and asserts the SQL result equals `isAllowed`. Tests write nothing to disk.

`@rag/hybrid-search` stores `allow_users` and `allow_groups` on its `chunks` table, so `allowClause` runs against it unchanged (see its `tests/integration/acl-wiring.test.ts`).
