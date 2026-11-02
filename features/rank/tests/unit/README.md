# unit

Fast, deterministic tests with an in-memory index and a fixed clock.

- `tokenize.test.ts`: normalisation, unicode, the 10,000 character read cap, the 32 term cap, the keyed term hash.
- `options-limits.test.ts`: `key` and `weights` validation, the size caps, and `remove` id validation.
- `formula.test.ts`: `idf`, `textScore`, `recency`, `linkSignal` and `combine` against values worked out by hand in the comments.
- `rrf.test.ts`: reciprocal rank fusion, including duplicates in a list, tie order, `k` validation and fusion properties.
- `api/`: input validation and the shape of a hit.
- `lifecycle/`: what happens to results as docs are added, replaced, removed and as access changes, and how odd input is handled.

Each hand-computed expectation states the arithmetic next to it, so a reviewer can redo it without running code.
