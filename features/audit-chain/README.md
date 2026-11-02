# @rag/audit-chain

An append-only audit log in which every entry's hash covers the previous entry's hash. Editing,
deleting or reordering any past entry changes every later hash, so `verify` finds it. Spec:
`docs/specs/feature/audit-chain.md` (ticket #36).

## How it works

- One chain per tenant. Entry N has `hash = sha256(prevHash + canonical(event))`. The first entry's
  `prevHash` is 64 zeros. `canonical` is RFC 8785 JSON via `json-canonicalize`, so key order in `detail`
  never changes the hash, and unicode and nested values are stable.
- Storage is `node:sqlite` (built in, no native add-on). Table `audit(tenant_id, seq, actor, action,
  target, at, detail, hash)` with primary key `(tenant_id, seq)`.
- Two triggers abort any SQL `UPDATE` or `DELETE` on the table. They are re-created on every open.
- `append` runs in `BEGIN IMMEDIATE`: it reads the tail, computes the hash and inserts in one write
  transaction. Two handles (threads or processes) on one file serialize on the SQLite write lock
  (30 s busy timeout), so the chain never forks.
- `verify` walks the tenant's rows in order, checks `seq` is 1, 2, 3 ... with no gap, recomputes each hash
  from the previous recomputed hash and compares it with the stored one. It returns the first bad `seq`.
  A missing row reports the seq that should have been there. Rows with unparseable `detail` count as broken.

## Interface

```ts
import { createAuditChain, AuditError } from "@rag/audit-chain";

const chain = createAuditChain("/var/lib/rag/audit.db"); // ":memory:" works for a single handle
const { seq, hash } = chain.append({
  tenantId: "acme",
  actor: "alice",
  action: "doc.read",
  target: "doc/42",
  at: "2026-01-01T12:00:00Z",
  detail: { via: "api", scopes: ["a", "b"] },
});
chain.verify("acme"); // { ok: true } or { ok: false, brokenAt: 7 }
const anchor = chain.head("acme"); // { seq, hash }; store it OUTSIDE this database (empty chain: seq 0, 64 zeros)
chain.verify("acme", anchor); // also fails on truncation or rewrite, see "Anchoring"
chain.list("acme", 0, 100); // entries with seq and hash, ordered, paged by afterSeq/limit (1..1000)
```
`append` throws `AuditError` with `code === "INVALID"` for bad input and `"STORAGE"` if SQLite fails.
Nothing is swallowed; the original error is on `error.cause`.

## Input rules

- `tenantId`, `actor`, `action`, `target`, `at`: non-empty strings, at most 1024 chars each.
- `at`: ISO-8601 with a time and `Z` or an offset. The clock is the caller's: nothing here reads the time.
- No NUL and no lone surrogates in those five fields (SQLite would truncate or rewrite them, which would
  break the hash). `detail` has no such limit because JSON escapes them.
- `detail`: optional plain object, canonical JSON at most 65536 chars, no `NaN`, `Infinity` or cycles.
- Unknown fields are rejected, because they would not be covered by the hash.

## Anchoring

Without an external anchor, deleting the newest rows or rewriting rows and recomputing every later hash
leaves a valid chain, so `verify(tenant)` returns `{ ok: true }`. This is inherent: the database alone cannot
prove what it used to contain. To detect it, store `head(tenant)` somewhere an attacker with this file
cannot reach (another host, a signed log, a ticket) and pass it back as `verify(tenant, anchor)`.

- An anchor older than the current head is fine: it proves history up to `anchor.seq` is unchanged.
- Fewer rows than `anchor.seq`: `{ ok: false, brokenAt: <first missing seq>, anchor: "truncated" }`.
- Row `anchor.seq` has a different hash: `{ ok: false, brokenAt: anchor.seq, anchor: "mismatch" }`.
- An internally broken chain still reports plain `brokenAt` first. Malformed anchors throw `INVALID`.
- Where to keep the anchor and how often to refresh it is the caller's job. This package does not store it.
- An anchor with `seq: 0` carries no information and always passes.

## Limits and what it does not do

- Signing and retention are out of scope.
- Someone with file write access can drop the triggers and rewrite the chain consistently. `verify` without
  an anchor catches only edits not followed by recomputing every later hash.
- Append speed is about 7 k/s on a laptop with a durable commit per entry (50k appends took 7.4 s);
  `verify` of 50k entries took 0.23 s.

## Test

```
pnpm --filter @rag/audit-chain test        # unit, property (fast-check), integration, scale
pnpm --filter @rag/audit-chain typecheck
pnpm --filter @rag/audit-chain mutation    # Stryker, break below 80 (last run 87.70)
```

- `tests/unit`: validation, hashing vectors, API behaviour, paging, `head` and anchored `verify` (truncation, rewrite).
- `tests/property`: random events verify ok; flipping any character of any stored field breaks verify at that row.
- `tests/integration`: raw-SQL tamper (edit, delete, reorder), triggers, reopen, two worker threads appending to one file.
- `tests/scale`: 50k appends then `verify` under 5 s.
- `types/node.d.ts` is a temporary shim because `@types/node` is not installed in the workspace.
