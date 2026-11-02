# integration

- `retry.test.ts`: an index step that throws leaves the pass to retry; `known` changes only after commit.
- `acl-only.test.ts`: a revoked reader is dropped although the connector version ignores the ACL.
- `big.test.ts`: 10,001 documents go in slices below the rank cap.
- `feed.test.ts`: listing to search, edit, delete.
