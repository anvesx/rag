# Spec: hybrid-search

Ticket: #34   Tier: feature   Milestone: M0   Design cards: qry.ret (qr_hyb)

## Purpose
Keyword + vector search over derived chunks, fused with Reciprocal Rank Fusion. The ACL filter
arrives as an opaque SQL fragment, so this package never imports `acl-filter`.
## Reuse decision
`node:sqlite` with built-in FTS5, plus `sqlite-vec@0.1.9` for vectors (verified: `sqliteVec.load(db)` works on `new DatabaseSync(path,{allowExtension:true})`). RRF is ours
(about 25 lines); Orama was rejected because it weights scores instead of fusing ranks.
## Public interface
```ts
export type Hit = { chunkId: string; docId: string; score: number };
export type AclFragment = { sql: string; params: unknown[] }; // a WHERE clause over table `chunks` (columns tenant_id, allow_users, allow_groups; the last two are JSON text, matching acl-filter)
export interface SearchIndex {
  add(c: { chunkId: string; docId: string; tenantId: string; text: string; embedding: number[]; acl: Acl }): void;
  search(q: { text: string; embedding: number[]; limit: number; offset?: number; acl: AclFragment }): Hit[];
  remove(docId: string, tenantId: string): number; // chunks removed, scoped to one tenant
  replace(docId: string, tenantId: string, chunks: AddChunk[]): void; // atomic remove + add in one transaction; on any failure the old chunks stay. Chunks must carry this docId and tenantId
  updateAcl(docId: string, tenantId: string, acl: Acl): number; // chunks updated, scoped to one doc in one tenant
}
export const MAX_WINDOW = 1000; // per-list fetch depth and the bound on offset + limit
export function createSearchIndex(dbPath: string, dim: number): SearchIndex;
export function rrf(lists: string[][], k?: number): { id: string; score: number }[]; // k default 60
```
## Behaviour
1. `rrf`: score = sum of 1/(k+rank), rank starting at 1. Ties break by id ascending. Empty lists allowed.
2. The ACL fragment is applied inside both the FTS query and the vector query, before ranking. A chunk the fragment excludes never appears, even at rank 1.
3. Embedding length not equal to `dim` throws `SearchError("DIM")`. Empty query text uses vector only; zero results returns `[]`.
4. `limit` 1..100. FTS input is escaped so quotes, `*` and `NEAR` cannot inject operators.
5. `remove` deletes from both indexes in one transaction, only for the given tenant.
6. `chunk_id` is unique per `(tenant_id, chunk_id)`, not globally. A duplicate inside one tenant throws `SearchError("DUPLICATE")`.
7. Any SQL failure in `search`, `add` or `remove` surfaces as `SearchError("DB")`.
8. `add` stores `acl.allowUsers` and `acl.allowGroups` as JSON text columns `allow_users` and `allow_groups`, so `allowClause` from acl-filter runs unchanged.
9. Pointer-only: the index never stores body text. `chunks` has no `text` column and `chunks_fts` is contentless (`content=''`); `add` tokenises `text` and discards it. A raw scan of the db file after checkpoint contains no body phrase. Hits carry `chunkId`/`docId`, never text.
10. `updateAcl` overwrites `allow_users`/`allow_groups` on all chunks of one `(docId, tenantId)` in one transaction.
11. `offset` (addendum): optional integer >= 0, default 0, applied to the fused RRF ranking (hit ranks `offset`..`offset+limit-1`). Invalid (negative, non-integer, non-number) or `offset + limit > MAX_WINDOW` throws `SearchError("OFFSET")`. Offset past the end returns `[]`. `limit` stays 1..100.
12. Stable pages (addendum): each search fuses the top `MAX_WINDOW` (1000) rows of each list regardless of `offset` and `limit`, so every page uses one ranking. Fetching only `offset + limit` per list was rejected: the fused scores, and so the order, would shift from page to page and pages would overlap or skip hits.
## Acceptance tests (first)
unit (rrf worked examples, tie order, escape), integration (3 docs, one forbidden by fragment, assert it never returns), mutation >= 80, scale (100k chunks, query under 150 ms, record in README).
## Layout
`features/hybrid-search/src/{rrf.ts,fts.ts,vec.ts,index-db.ts,escape.ts,errors.ts}`.
## Out of scope
Embedding generation, reranking, hydration.
