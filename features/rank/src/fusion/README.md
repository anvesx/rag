# fusion

`rrf(lists, k = 60)`: reciprocal rank fusion, exported for callers that combine rank's output with another ranker (for example a vector search in the RAG app).

Each id scores the sum of `1 / (k + rank)` over the lists it appears in, with rank counted from 1. Results sort by score descending, then id ascending, so the output is deterministic.

- A list that repeats an id counts it once, at its first position.
- `k` must be a positive finite number, otherwise `RangeError`.
- It works on ids only. It reads no scores, so rankers with different score scales fuse cleanly.

RRF is not applied inside `search`. The in-index signals (text, recency, links) are combined by the formula in `text/`.
