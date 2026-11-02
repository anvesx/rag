# @rag/hybrid-search

Local keyword + vector retrieval for derived chunks. FTS5 ranks literal keyword
queries with BM25; `sqlite-vec@0.1.9` ranks embeddings by L2 distance (same order as cosine for normalized embeddings); RRF
combines the two rank lists. The package generates no embeddings and returns no
document body.

## Interface

`createSearchIndex(dbPath, dim)` returns synchronous `add`, `search`, and
`remove(docId, tenantId)`, `replace(docId, tenantId, chunks)`, and `updateAcl(docId, tenantId, acl)` operations. The index is pointer-only: `chunks` has no body text column and the FTS5 table is contentless (`content=''`), so only tokens and positions are stored, never the text. `add` takes `text` to tokenise it and discards it; hits carry `chunkId`, `docId` and `score`. `chunks` stores `tenant_id`, `allow_users`, and `allow_groups` (JSON text), so the `allowClause` output of `@rag/acl-filter` runs against it unchanged. `search` accepts an opaque parameterized SQL predicate over
`chunks`. The predicate executes inside both retrieval statements, so excluded
chunks cannot enter either list. `rrf(lists, k = 60)` is also public.

```ts
import { createSearchIndex } from "@rag/hybrid-search";

const index = createSearchIndex("./rag.sqlite", 3);
index.add({
  chunkId: "c1",
  docId: "d1",
  tenantId: "acme",
  text: "incident runbook",
  embedding: [0.1, 0.2, 0.3],
  acl: { allowUsers: ["u1"], allowGroups: [], version: 1 },
});
const hits = index.search({
  text: "incident",
  embedding: [0.1, 0.2, 0.3],
  limit: 10,
  acl: { sql: "tenant_id = ?", params: ["acme"] },
});
```

## Guarantees and limits

- Embeddings must match the fixed dimension; limits are integers from 1 to 100.
- `offset` (optional integer >= 0, default 0) skips that many hits of the fused RRF ranking. `offset + limit` must be <= `MAX_WINDOW` (1000), else `SearchError("OFFSET")`; an invalid offset is also `OFFSET`. An offset past the last hit returns `[]`.
- Every search fuses the same top `MAX_WINDOW` (1000) rows of each list (FTS and vec), then slices `[offset, offset + limit)`. Pages therefore share one ranking: they never overlap or skip, and a page equals the same slice of a longer page. Fusing only `offset + limit` rows per list would change scores between pages. Cost: up to 1000 rows per list per call, whatever `limit` is. Hits ranked below `MAX_WINDOW` in both lists are unreachable.
- FTS quotes, `*`, and `NEAR` are quoted as literals, never query operators.
- Chunk ids are unique per tenant; removal is scoped to one tenant. SQL errors surface as `SearchError("DB")`.
- `replace` removes a doc's chunks and adds the new ones in one `BEGIN IMMEDIATE` transaction. Every chunk is validated first (`DIM`, `INPUT`; each chunk must carry the given `docId` and `tenantId`). Any later failure, such as `DUPLICATE` (a chunk id twice in the list or owned by another doc of the tenant), rolls the whole swap back, so the old chunks stay searchable. An empty list removes the doc. The argument order matches `remove` and `updateAcl` (`docId`, then `tenantId`).
- `updateAcl` rewrites `allow_users` and `allow_groups` on every chunk of one doc in one transaction.
- Existing databases created with a `text` column must be rebuilt (re-index); there is no migration.
- Removal updates chunks, FTS5, and sqlite-vec in one `BEGIN IMMEDIATE` transaction.
- One instance is synchronous. Separate writers wait up to 5 seconds via SQLite.
- ACL SQL is trusted compiler output; values belong in `params`, not the SQL string.
- vec0 caps knn at 4096; selective ACLs fall back to an exact scan of allowed rows.
- sqlite-vec is pre-1.0 and brute-force; this adapter is not the 1M-chunk backend.

## Scale evidence

Apple arm64, Node 26.0.0, in-memory SQLite, 100,000 two-dimensional chunks,
November 2, 2026: five warm query runs were `4.50, 3.51, 3.48, 3.44, 3.51 ms`
(min 3.44, max 4.50 ms). Loading the fixture took 17.8 seconds. This measures
query latency, not ingestion throughput or larger production dimensions.

## Verify

Run `pnpm test`, `pnpm typecheck`, and `pnpm mutation` from this directory.
The scale assertion is `<150 ms`; mutation must be at least 80%. Last run: 93.82 (run `pnpm exec stryker run --inPlace --concurrency 2`; the 150 ms scale test can flake at the default concurrency).
