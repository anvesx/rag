# Pipeline

- `content.ts`: `verifyContent` (caller-supplied text) and `verifyFetched` (fetched text) check sha-256 against `pointer.contentHash`; `HASH_MISMATCH` on a difference.
- `prepare.ts`: fetch text, verify its hash, chunk it, embed it, and validate the vectors. Touches no stored state.
- `replace.ts`: `probe` (dimension check against the index), `replace` (one atomic `index.replace`), `restore` (rollback that keeps the narrowed ACL in registry and index; a failed replace restores the prior pointer and leaves the old chunks).
- `lock.ts`: runs tasks for one key in call order; different keys run in parallel.
