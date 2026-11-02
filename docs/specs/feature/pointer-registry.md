# Spec: pointer-registry

Ticket: #30   Tier: feature   Milestone: M0   Design cards: idx.reg

## Purpose
Store one pointer row per document: where it is, its version, hash, zone and ACL. Never body text.
## Reuse decision
`node:sqlite` (built into Node 26, no native build; `better-sqlite3@13.0.3` failed to compile on Node 26 and drizzle has no node:sqlite driver, so plain SQL with prepared statements). Postgres adapter later.
## Public interface
```ts
export interface Registry {
  upsert(p: Pointer): { pointer: Pointer; change: "created" | "updated" | "unchanged" };
  get(tenantId: string, id: string): Pointer | undefined;
  list(q: { tenantId: string; afterId?: string; limit?: number }): Pointer[]; // limit default 100, max 1000
  tombstone(tenantId: string, id: string, at: string): boolean; // true if a live row was marked
}
export function createRegistry(dbPath: string): Registry; // ":memory:" allowed
export class RegistryError extends Error { code: "INVALID" | "TENANT_REQUIRED" }
```
## Behaviour
1. Key is (tenantId, id). `upsert` validates with `PointerSchema`; invalid input throws `RegistryError("INVALID")`.
2. `unchanged` and no write only when every stored field equals the incoming one: hash, version, source, address, title, zone, deletedAt, acl.version and both ACL lists (compared as sorted sets). `updatedAt` alone is not a change. Any other difference is `updated` and the whole row is rewritten, so a zone move or an ACL removal without an `acl.version` bump is still applied.
3. Every method needs a non-empty tenantId; no cross-tenant read is possible.
4. `tombstone` sets deletedAt; the row stays. `list` and `get` hide tombstoned rows unless re-upserted.
5. Table has no column that can hold body text. Test asserts the exact column list.
6. Concurrent upserts of the same key end with one row (use a transaction + unique key). Test: 6 OS processes hit one key at once; exactly one `created`, no errors, no lost call.
7. Unicode ids and 2048 char addresses work. `list` pages by id, stable order.
## Acceptance tests (first)
- unit: change detection, validation errors, tenant isolation, tombstone, paging.
- integration: file-backed db survives reopen; same-key contention from 6 separate processes ends with one row and exactly one `created`.
- mutation: score >= 80.   scale: 100k upserts under 30 s, list page under 20 ms (record numbers in README).
## Layout
`features/pointer-registry/{src/{schema.ts,registry.ts,errors.ts,index.ts},tests/{unit,integration,scale},README.md,package.json,...}` copy configs from `features/core-types`.
## Out of scope
Postgres adapter, search, ACL checks.
