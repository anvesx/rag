# Spec: acl-filter

Ticket: #35   Tier: feature   Milestone: M0   Design cards: acl.enf (ac_filter)

## Purpose
Turn a principal into a SQL predicate and an equivalent pure check. Deny by default.
## Reuse decision
No library fits; this is a 30 line predicate. Test the SQL with `node:sqlite` and `fast-check@4.10.2`.
## Public interface
```ts
export function isAllowed(p: Principal, acl: Acl, rowTenant: string): boolean;
export function allowClause(p: Principal): { sql: string; params: unknown[] }; // over columns tenant_id, allow_users (json), allow_groups (json)
```
## Behaviour
1. Allowed only if tenant matches AND (user id in allowUsers OR any group in allowGroups).
2. Empty allow lists mean nobody. A principal with no groups and an id not listed is denied.
3. `allowClause` uses bound params only; ids with quotes, `%` or unicode never change the SQL text.
4. Property test: for random principals and ACLs, SQL result over a real sqlite table equals `isAllowed`.
5. 1000 groups on a principal still works; tenant mismatch always denies.
## Acceptance tests (first)
unit (truth table), property (SQL equals JS, 1000 runs), integration (real table), mutation >= 80.
## Layout
`features/acl-filter/src/{allowed.ts,clause.ts,index.ts}`.
## Out of scope
Cedar policies, zone rules, groups lookup.
