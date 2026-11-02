# src

Source of `@rag/rank`. One file has one job.

- `index.ts` is the public surface: `RankIndex`, `RankError`, `rrf`, `WEIGHTS` and the types.
- `rank-index.ts` is the `RankIndex` class. It opens the database, validates input, refuses calls after `close()`, and delegates. It holds no ranking logic.
- `rank-search.ts` runs one search inside a single read transaction: terms, visible-set statistics, postings, metadata, inbound links, scoring, sorting. It reports the time of each stage to an optional `probe(stage, ms)` callback.
- `model/` holds types, error codes and input validation.
- `text/` holds the tokenizer and the scoring formula, both pure.
- `store/` holds the SQLite schema, transactions and every SQL statement.
- `fusion/` holds the standalone reciprocal rank fusion utility.

Dependencies point one way: `rank-index` uses `rank-search`, which uses `store`, `text` and `model`. Nothing in `text` or `fusion` touches the database, so both are tested without one.
