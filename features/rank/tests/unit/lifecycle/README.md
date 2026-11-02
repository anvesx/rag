# unit/lifecycle

How results change over time and under odd input.

- `lifecycle.test.ts`: indexing, re-indexing the same id (old terms stop matching), duplicate ids in one batch (last wins), `remove`, and the `indexed` and `removed` counts.
- `acl.test.ts`: granting and revoking access, a doc visible to one of several principals, and hidden docs leaving no trace in scores, counts or order.
- `syntax.test.ts`: query strings made of FTS5 syntax (`"`, `*`, `NEAR(`, `AND`, column filters, SQL text) are plain words and never throw or widen a match.
- `edge.test.ts`: a one megabyte query, thousands of terms, a one megabyte body, empty fields, emoji, right-to-left and astral characters, and repeat-query stability.

Interleaved calls on one handle live in `integration/connections.test.ts`.
