# @rag/pointer-registry

Stores one pointer row per document: where it lives, its version, content hash, trust zone and ACL.
It never stores body text. The table has twelve columns and none can hold a document body; a test
asserts the exact column list. Spec: `docs/specs/feature/pointer-registry.md` (ticket #30).

## What it does

- Key is `(tenantId, id)`. Every method requires a non-empty `tenantId`, and every query filters on it, so one tenant cannot read another.
- `upsert` validates with `PointerSchema` from `@brain/core-types`, then compares every stored field with the stored row: hash, version, source, address, title, zone, `deletedAt`, `acl.version` and both ACL lists (as sorted sets). All equal: `unchanged`, nothing written, the stored pointer is returned. `updatedAt` alone does not count as a change. New key: `created`. Otherwise `updated` and the whole row is rewritten.
- `tombstone` sets `deletedAt` and keeps the row. `get` and `list` hide tombstoned rows. Upserting the same key again revives it (reported as `updated`).
- Each upsert runs in `BEGIN IMMEDIATE` with a primary key on `(tenant_id, id)`, so concurrent upserts of one key, even from two connections to one file, end with one row. Busy writers wait up to 10 s.
- `list` pages by `id` in binary order. `afterId` is exclusive. Default limit 100, values above 1000 are clamped to 1000.
- Backend is `node:sqlite` (built into Node 26) with plain prepared SQL. `better-sqlite3` failed to compile on Node 26 and drizzle has no `node:sqlite` driver. File databases use WAL and `synchronous=NORMAL`.

## Interface

```ts
interface Registry {
  upsert(p: Pointer): { pointer: Pointer; change: "created" | "updated" | "unchanged" };
  get(tenantId: string, id: string): Pointer | undefined;
  list(q: { tenantId: string; afterId?: string; limit?: number }): Pointer[];
  tombstone(tenantId: string, id: string, at: string): boolean; // true if a live row was marked
  close(): void; // added beyond the spec so file handles can be released
}
createRegistry(dbPath: string): Registry; // ":memory:" allowed
class RegistryError extends Error { code: "INVALID" | "TENANT_REQUIRED" }
```
Errors: invalid pointer, non-object input, bad `at`, or `limit` that is not a positive integer throw `INVALID`. A missing or empty `tenantId` throws `TENANT_REQUIRED`. Database errors propagate unchanged after rollback.

## Usage

```ts
import { createRegistry } from "@rag/pointer-registry";
const reg = createRegistry("./registry.db");
const { change } = reg.upsert(pointer); // "created"
reg.get("acme", pointer.id); // Pointer
reg.list({ tenantId: "acme", afterId: lastId }); // next page
reg.tombstone("acme", pointer.id, new Date().toISOString());
reg.close();
```

## Limits

- One writer at a time per database file (SQLite). Calls are synchronous.
- An upsert that differs only in `updatedAt` is `unchanged`, so the stored `updatedAt` is not advanced.
- `tombstone` does not bump `updatedAt`.
- Out of scope: Postgres adapter, search, ACL checks.

## Test

From this folder: `pnpm test`, `pnpm typecheck`, `pnpm mutation` (break below 80).
Tests write only to temp dirs. The 100k scale test is skipped under Stryker.

Last run: 44 tests pass. Mutation score 94.07 (103 killed, 8 timeout, 5 survived, 2 uncovered).
Scale (Node 26.0.0, macOS, file-backed): 100k upserts in 5.6 s (limit 30 s); list page of 100 in 0.53 ms (limit 20 ms).
