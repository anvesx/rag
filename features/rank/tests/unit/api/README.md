# unit/api

The public contract of `RankIndex`.

- `validate-index.test.ts`: every way a doc can be malformed throws `BAD_DOC`, a bad doc in a batch writes nothing, the length limit is exact, a non-array is refused, and every method throws `CLOSED` after `close()`.
- `validate-search.test.ts`: a missing, empty, oversized or malformed asker throws `BAD_ASKER` before the index is touched. Bad `k` and non-string queries throw `BAD_QUERY`.
- `search.test.ts`: ranking order, field weights (title over path over body), `k`, deterministic tie order, and that a hit carries only `id`, `path`, `score` and `signals`, never title or body.
- `signals.test.ts`: the per-signal breakdown matches the formula, recency decays with age, inbound links raise the score, and a link from a doc the asker cannot read does not count.
