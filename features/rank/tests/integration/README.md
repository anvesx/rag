# integration

Tests against a real SQLite file in the OS temp directory, removed after each test.

- `file.test.ts`: data survives close and reopen, the raw file bytes contain no title or body text and no hex of it, no FTS or vocab table exists, an old FTS5 file is refused, the `docs` table has only pointer and count columns, 300 docs match the oracle through the file, and reopening does not wipe the schema.
- `privacy.test.ts`: what a reader of the raw file can recover: no positional table, identical rows for reordered words, no hex or plain hash of a word, different terms under a different key.
- `connections.test.ts`: a second connection reads whole index batches while the first writes, a revoke made on one connection applies to the next search on another, and interleaved async calls on one handle never expose half a batch.

- `internals.test.ts`: the file is in WAL mode, and the `probe` callback reports each search stage once, in order, and stops early on an empty query or an empty index. Re-indexing the same docs and removing some keeps working.
- `tx/`: `writeTx` and `readTx` keep the original error when `ROLLBACK` or `COMMIT` fails.

Concurrency coverage is limited to what one Node thread can do: interleaving at `await` points, and two handles on one WAL file taking turns. It does not race two OS threads.
