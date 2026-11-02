# model

The vocabulary of the package and the gate that input passes through.

- `types.ts`: `Doc` (id, title, path, body, principals, mtimeMs, links), `SearchRequest` (query, `asker.principals`, optional `k`), `Hit` (id, path, score, `signals`), `Signals` (text, recency, links), `Cols` (title, path, body weights or counts), `Probe`, `OpenOptions` (`key` required, `now`, `weights`).
- `errors.ts`: `RankError` with a `code` of `BAD_DOC`, `BAD_ASKER`, `BAD_QUERY`, `BAD_OPTIONS`, `BAD_INDEX` or `CLOSED`.
- `validate.ts`: `validateDoc`, `validateDocs`, `validateIds`, `validateRequest`, `validateWeights` and `validateKey`.

## Validation rules

- Ids, paths, principals and link targets must be non-empty, well-formed UTF-16 (no lone surrogates), contain no NUL, and fit the length limit (1024 for ids, paths and links, 256 for principals). Titles and bodies may be empty but must be well-formed and at most 2,000,000 characters. A doc has at most 1,000 principals and 1,000 links. A batch has at most 10,000 docs. `remove` takes the same id rules and the same 10,000 cap, and a non-array or a string is `BAD_DOC`. `mtimeMs` must be finite.
- `weights` must be `{ title, path, body }` with finite numbers of at least 0, and `key` a string or bytes of at least 16 bytes, otherwise `BAD_OPTIONS`.
- An index batch is validated in full before anything is written, so one bad doc writes nothing.
- The asker must carry 1 to 256 principals. Anything else, including a missing asker, an empty list, a non-array or a non-string entry, throws `BAD_ASKER`. This runs before the database is touched, which is what makes the search fail closed.
- `k` defaults to 10 and must be an integer from 1 to 100, otherwise `BAD_QUERY`. A non-string query is also `BAD_QUERY`. An empty or all-punctuation string is a valid query that matches nothing.
