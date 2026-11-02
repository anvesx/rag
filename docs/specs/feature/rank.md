# Spec: rank

Tier: feature. Package: `@rag/rank`. Phase 1 of the pointer-search build plan (`docs/research/web-search/build-plan.md` on branch `research-web-search` of company-brain).

Exact source: our proposal, no exact source backs it. The audit table is in the company-brain repo, `docs/research/exact/README.md`. The brain is a graph of metadata (ADR 0004 in the company-brain repo), so ranking over text lives here, and this package returns pointers and never document bodies. Moved from company-brain (its ADR 0006).

## Purpose
Rank documents for a query and return pointers only: id, path, score and the per-signal breakdown. Text relevance is BM25F over title, path and body. Recency and inbound links are small priors. The asker's access is applied inside every query, so a document the asker cannot read has no effect on any result, count, score or order.

## Reuse decision
Engine: `node:sqlite` (public domain). The inverted index is a plain `postings(term, doc, col, tf)` table: no text, no word positions. `term` is an HMAC-SHA256 of the token under a key the caller supplies at `open()`. An earlier version used a contentless FTS5 table with `detail=full`, which `fts5vocab` exposed with hex-encoded words and their positions; that was readable and was replaced.

Why not FTS5's `bm25(t, w...)` function: it computes IDF and average column length over the whole table, hidden rows included. A hidden document that contains a query term changes `df`, `N` and `avgdl`, so it changes the score and can reorder the visible hits. That is an existence leak through score. So BM25F is computed over the visible set only (ACL-filtered `N`, `df`, `avgdl`). Column weights, `k1` and `b` are the same parameters `bm25()` takes. This deviates from the brief's "bm25(t, w...)" for that reason.

Libraries: `fast-check` 4.10.2 (MIT, tests, already in the workspace), `hdr-histogram-js` (BSD-2-Clause, bench script only). No dependency on other feature packages (`tools/structure-lint`).

## Public interface
```ts
type Doc = { id: string; title: string; path: string; body: string; principals: string[]; mtimeMs: number; links: string[] };
type Asker = { principals: string[] };
type SearchRequest = { query: string; asker: Asker; k?: number };           // k default 10, 1..100
type Signals = { text: number; recency: number; links: number };            // links = ln(1 + inbound)
type Hit = { id: string; path: string; score: number; signals: Signals };
class RankIndex {
  static open(file: string, opts?: { now?: () => number }): RankIndex;     // ":memory:" allowed
  index(docs: readonly Doc[]): { indexed: number };                          // upsert by id, atomic
  remove(ids: readonly string[]): { removed: number };
  search(req: SearchRequest, probe?: (stage: string, ms: number) => void): Hit[];
  close(): void;
}
function rrf(lists: readonly (readonly string[])[], k?: number): { id: string; score: number }[];  // k = 60
class RankError extends Error { code: "BAD_DOC" | "BAD_ASKER" | "BAD_QUERY" | "CLOSED" }
```
`principals` is how a zone is expressed. The caller maps a zone to strings (for example `user:ana`, `team:eng`, `company`); a doc is visible when its principals share one string with the asker's.

## Behaviour
1. Pointers only. A `Hit` holds no title and no body. The index stores `id`, `path`, `mtimeMs`, per-column token counts, ACL rows, link edges and postings. Postings are keyed hashes of tokens with term frequencies, not text and not positions.
2. Tokens: NFC, lower case, runs of letters, digits and combining marks. Each token is keyed-hashed before it is stored or looked up. No user text reaches an SQL or FTS5 query string, so query syntax (`"`, `*`, `NEAR(`, `AND`, `-`) is plain punctuation and cannot inject.
3. Query: only the first 10,000 characters are read; distinct tokens, first 32 kept, OR semantics. No tokens (empty, punctuation only) returns `[]`. A non-string query is `BAD_QUERY`. `k` outside 1..100 or not an integer is `BAD_QUERY`.
4. Visible set `V(asker)` = documents with at least one ACL principal in `asker.principals`. A document with no principals is visible to nobody. Every statement that reads documents, postings, lengths or links is restricted to `V` inside the SQL (`doc IN (SELECT doc FROM acl WHERE principal IN (SELECT value FROM json_each(?)))`). There is no post-filter.
5. Fail closed: `principals` missing, not an array, empty, over 256 entries, or holding an empty, non-string or over-256-character entry is `BAD_ASKER`. Nothing is returned.
6. Text score, BM25F over `V`: for each query term `t`, `idf = ln(1 + (N - df + 0.5) / (df + 0.5))`, `tf' = sum over c of w_c * tf_c / (1 - b + b * len_c / avglen_c)`, `text = sum idf * tf' / (k1 + tf')`. `N`, `df` and `avglen_c` are over `V`. Weights `w` title 3, path 2, body 1; `k1` 1.2, `b` 0.75. A column with `avglen = 0` contributes no tf. Documents with `text = 0` are not candidates.
7. Recency: `recency = 0.5 ^ (max(0, now - mtimeMs) / H)`, `H` = 90 days. A future `mtimeMs` counts as age 0.
8. Links: `links = ln(1 + inbound)`, `inbound` = distinct documents in `V`, other than the document itself, whose `links` name it. Links from hidden documents do not count.
9. Combined: `score = text * (1 + 0.2 * recency + 0.1 * links)`. Priors only scale a text match, they never create one.
10. Order: score descending, then `id` ascending (code-unit order). The order depends only on visible data.
11. `index` validates every doc first and writes nothing on any `BAD_DOC`. Rules: `id` and `path` non-empty, well-formed strings up to 1024 characters with no NUL, `title` and `body` well-formed strings, `principals` (each up to 256 characters) and `links` arrays of such keys, `mtimeMs` a finite number. `indexed` is the number of distinct ids written. Duplicate ids in one call: the last wins. Re-indexing an id replaces its postings, ACL rows and links. Links to ids that are not indexed are kept and start counting once the target exists. Self links are ignored.
12. `remove` deletes postings, ACL rows, links and the doc row. Unknown ids are ignored.
13. One transaction per `index`, `remove` and `search`. A search sees one snapshot (WAL), so a concurrent `index` is seen whole or not at all. `busy_timeout` is 5 s.
14. After `close`, every call throws `CLOSED`.
15. `rrf(lists, k = 60)`: `score(id) = sum over lists of 1 / (k + rank)`, rank from 1, an id counted once per list. Sorted by score descending then id ascending. `k` must be a positive finite number, else `RangeError`.

## Acceptance tests (written first)
- unit: tokenizer, formula, rrf, validation, errors, ordering and ties.
- property (fast-check): for random ACL graphs, results are a subset of the permitted docs; results equal the oracle.
- differential: a brute-force oracle (scan all docs, filter by ACL, recompute BM25F in plain TypeScript) gives the same ids, order, and scores to 1e-9.
- canary leak: a hidden document stuffed with the query terms changes nothing the asker sees (ids, scores, signals, order, count).
- edge: empty, unicode, huge query, FTS5 syntax strings, duplicate ids, reindex, concurrent index and search, closed handle.
- integration: a real sqlite file, reopen, two connections.
- eval: nDCG@10, recall@20 and MRR against hand-computed values; a 40-query golden set; BM25F against equal-weight BM25 on nDCG@10.
- mutation: Stryker score >= 80, concurrency 1.
- latency bench (script, not a test): open-loop, fixed rate, HdrHistogram, 1k and 10k docs.

## Layout
`features/rank/{src,tests,scripts}`. `src/` holds `index.ts`, `rank-index.ts`, and the folders `model/` (types, errors, validate), `text/` (tokenize, formula), `store/` (schema, write, read) and `fusion/` (rrf). `tests/` holds `unit/`, `property/`, `integration/`, `eval/`, `support/`. `scripts/bench/` holds the latency bench.

## Out of scope
Vectors and hybrid retrieval (rrf is exported for it), learning to rank, click signals, closeness to the asker's work, folder priors, stemming and synonyms, prefix and phrase queries, live ACL checks against the source system (the caller does those, as in `connector-kit`).
