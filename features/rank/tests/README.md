# tests

Beside `src`, split by what each group proves.

- `unit/`: pure functions and the public API, one behaviour per test. `unit/api/` covers validation and result shape, `unit/lifecycle/` covers re-index, remove, ACL changes and edge input.
- `property/`: fast-check properties, the differential test against the brute-force oracle, the canary leak tests and the adversarial no-fake guard.
- `integration/`: a real SQLite file on disk, including two connections to the same file.
- `eval/`: relevance quality. Metrics, a generated corpus, 46 golden queries, and the BM25F against plain bm25 comparison.
- `support/`: builders and the independent oracle shared by the groups above.

Run everything with `pnpm --filter @rag/rank test`. The latency bench is a script under `../scripts/bench`, not a test, because a timing assertion on a shared machine is flaky and proves little.

Rules every test follows: no mocking of the index or SQLite, no assertion that a function was called, and any test that could pass against a stub is paired with a check in `property/fakes.test.ts`.
