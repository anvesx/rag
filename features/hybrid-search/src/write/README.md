# Chunk write path

`insert.ts` writes one chunk into `chunks`, `chunks_fts` and `chunks_vec`. It sits apart from `search/db.ts` because `fts.ts` and `vec.ts` import `db.ts`, so `db.ts` importing them back would make a cycle.

The caller owns the transaction: `add` wraps one call, `replace` wraps a `removeDoc` plus many calls, so a failure anywhere rolls back the whole swap.
