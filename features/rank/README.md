# @rag/rank

Permission-aware ranked search over document metadata. Give it documents, ask with a set of principals, get back ranked pointers.

Spec: `docs/specs/feature/rank.md`.

## The index stays pointers only

`search` returns `{ id, path, score, signals }` per hit. It never returns a title or a body. The index stores no body text and no title text. The SQLite file holds, per doc, the id, the path, the mtime, three token counts, ACL rows, link rows, and a `postings` table of (keyed term, doc, column, term frequency). A term is an HMAC-SHA256 of the token under your key, cut to 128 bits. There are no word positions, so word order is not stored. `tests/integration/file.test.ts` and `privacy.test.ts` read the raw file and the tables and assert that no word, no hex of a word and no plain hash of a word is present, that the same words in another order give identical rows, and that a different key gives different terms. The path is stored because it is the pointer. A caller that wants the content follows the pointer to the source system, which checks access again.

## API

```ts
const ix = RankIndex.open(file, { key, now?, weights? });     // ":memory:" or a path; key is required
ix.index(docs: Doc[]): { indexed: number };                   // upsert by id, one transaction
ix.remove(ids: string[]): { removed: number };
ix.search({ query, asker: { principals }, k? }, probe?): Hit[];
ix.close();

type Doc = { id; title; path; body; principals: string[]; mtimeMs: number; links: string[] };
type Hit = { id; path; score; signals: { text; recency; links } };
rrf(lists: string[][], k = 60): { id; score }[];              // exported utility
```

`k` defaults to 10, maximum 100. `probe(stage, ms)` is optional and receives per-stage timings. `weights` and `now` exist for tests and the eval.

`key` is required, a string or bytes of at least 16 bytes. Generate it randomly (for example 32 bytes from a CSPRNG), keep it in your secret store, and pass the same key every time you open the same file. It is never written to the file. A different key opens the file but finds nothing, and the postings written under the old key stay in the file as unreadable rows until those docs are re-indexed. A file from the old FTS5 format is refused with `BAD_INDEX`: build a new file.

Errors are `RankError` with a `code`: `BAD_DOC`, `BAD_ASKER`, `BAD_QUERY`, `BAD_OPTIONS`, `BAD_INDEX`, `CLOSED`.

## Limits

Checked before anything is written, so one bad value writes nothing: id, path and link target up to 1,024 characters, principal up to 256; title and body up to 2,000,000 characters each; up to 1,000 principals and 1,000 links per doc; up to 10,000 docs per `index` call and 10,000 ids per `remove` call (ids follow the doc id rules; a bare string is refused). `weights` must be `{ title, path, body }`, each finite and at least 0, otherwise `BAD_OPTIONS`. A bad key is `BAD_OPTIONS` too.

## What the file reveals

With the file and without the key, a reader sees the path of every doc, the ACL principals, the link targets and ids, per-column token counts, and for each doc the set of keyed terms with their frequencies. They cannot read words, and cannot test a guess of a word against the file. They can still see which docs share a term, how common each term is and how often it occurs, so a determined reader with a large reference corpus could try frequency analysis on rare and common terms. The keyed hash raises the cost; it is not encryption. Use disk encryption and file permissions for the file as well. Anyone holding the key can test guesses.

## Ranking formula

Everything below is computed over the documents the asker may read, and only those.

```
idf(t)    = ln(1 + (N - df + 0.5) / (df + 0.5))
tf'(t,d)  = sum over columns c of  w_c * tf_c / (1 - b + b * len_c / avglen_c)
text(d)   = sum over query terms of  idf(t) * tf' / (k1 + tf')
recency   = 0.5 ^ (age_in_days / 90)
links     = ln(1 + inbound links from readable docs)
score(d)  = text(d) * (1 + 0.2 * recency + 0.1 * links)
```

Weights `w` are title 3, path 2, body 1. `k1` is 1.2 and `b` is 0.75. Hits sort by score descending, then id ascending. Recency and links multiply the text score, so a doc with no matching term scores 0 and is not returned. Each hit's `signals` carry `text`, `recency` and `links` so a caller can see why it ranked.

`rrf` is a separate export for fusing this package's ranking with another ranker. It is not applied inside `search`.

## Permissions

- The ACL is a pre-filter inside every statement. Statistics (N, df, average length), postings, metadata and inbound link counts all run over the readable set. Nothing is ranked and trimmed afterwards.
- A hidden doc therefore cannot change a visible doc's score, the number of hits or their order. `tests/property/canary.test.ts` adds a perfect-match hidden doc and checks that the results are exactly equal.
- Fail closed: a missing, empty or malformed asker throws `BAD_ASKER` before the database is queried. An unknown principal matches no docs and returns an empty list.
- Link counts include only links from docs the asker can read.

## Why FTS5 `bm25()` is not used

The brief suggested `bm25(t, w...)`. FTS5's function computes IDF and average length over the whole table. A hidden doc then moves a visible doc's score, and the score, rank and count of a probe query reveal that a hidden doc exists. So the index keeps its own `postings` table of term frequencies and computes BM25F itself over the readable set.

## Text handling

One JavaScript tokenizer is used for indexing and for queries: NFC, lowercase, split on letters, digits and combining marks, then each token HMAC-keyed and stored in `postings`. User text never reaches an FTS5 or SQL expression, so `"`, `*`, `NEAR(`, `AND` and column filters are plain words. A query is read up to 10,000 characters and uses at most 32 distinct terms.

## Evidence

- Tests: `pnpm --filter @rag/rank test`. Unit, fast-check properties, differential test against a brute-force oracle, canary leak test, edge cases, a real SQLite file, what the file reveals, and the no-fake guard.
- Quality: `tests/eval`. On a synthetic corpus of 400 docs and 46 labelled queries, BM25F reaches nDCG@10 0.989 and plain bm25 reaches 0.766. See `tests/eval/README.md` for what this does and does not show.
- Mutation: `pnpm --filter @rag/rank mutation`.

## Latency

Command: `pnpm --filter @rag/rank bench`. Open loop at 20 queries per second, 1500 samples per corpus, HdrHistogram, latency measured from the scheduled arrival. The machine was a laptop with other work running (load average about 3), so treat the numbers as indicative only. Queries come from a Zipf-like vocabulary, so many contain a term found in most docs, which is a heavy case.

| Corpus      | p50      | p95      | p99       | CPU per query | Index size per doc |
| ----------- | -------- | -------- | --------- | ------------- | ------------------ |
| 1,000 docs  | 5.86 ms  | 18.59 ms | 22.16 ms  | 7.08 ms       | 614 bytes          |
| 10,000 docs | 23.84 ms | 84.86 ms | 101.25 ms | 26.43 ms      | 529 bytes          |

At 10,000 docs the `postings` stage dominates (p50 10.60 ms, p95 59.71 ms). Cost grows with the number of readable docs that contain a query term, because each one is scored. There is no top-k pruning. Search is synchronous, so throughput on one thread tops out near 1000 divided by the CPU time per query, about 37 queries per second at 10,000 docs.

## Known limits

- No prefix, phrase or fuzzy queries. Matching is whole tokens.
- Concurrency is tested for interleaved calls on one handle and two handles on one WAL file. Two OS threads are not raced.
- Every readable doc that matches a term is scored. Corpora far beyond 10,000 docs with very common terms need pruning, which is not built.
- The eval corpus is synthetic.

## Layout

`src/` code, `tests/` tests, `scripts/bench/` the latency bench. Each folder has a README.
