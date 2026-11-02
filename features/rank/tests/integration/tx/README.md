# integration/tx

Transaction helpers against a real `DatabaseSync`.

- `tx.test.ts`: when `ROLLBACK` or `COMMIT` itself fails, `writeTx` and `readTx` still throw the original error, and a failed `COMMIT` is reported as such.
