# text

Pure functions. No database, no clock, no I/O.

## tokenize.ts

One tokenizer serves indexing and querying, so the two cannot disagree.

1. Normalise to NFC and lowercase.
2. Split on `/[\p{L}\p{N}\p{M}]+/gu`: letters, digits and combining marks stay inside a token.

`keyed.ts` turns a token into the stored term: HMAC-SHA256 under the caller's key, first 128 bits as hex. Neither FTS5 nor any query syntax sees user text, so `"`, `*`, `NEAR(` and column filters are plain words. `queryTerms` reads at most the first 10,000 characters, keeps distinct tokens and caps them at 32. It returns plain tokens; the caller keys them.

## formula.ts

BM25F computed over the set of documents the asker may see. See the package README for the full formula and the reason SQLite FTS5's built-in `bm25()` is not used.

- `idf(n, df)` is `ln(1 + (n - df + 0.5) / (df + 0.5))`, always positive.
- `textScore(terms, lengths, averages, weights)` sums per-term `idf * tf' / (k1 + tf')` where `tf'` is the length-normalised, column-weighted term frequency.
- `recency(now, mtimeMs)` is `0.5 ^ (age / 90 days)`, clamped so a future mtime counts as age zero.
- `linkSignal(inbound)` is `ln(1 + inbound)`.
- `combine(text, recency, links)` is `text * (1 + 0.2 * recency + 0.1 * links)`. Recency and links only scale a text match, so a doc with no matching term scores zero and never appears.
