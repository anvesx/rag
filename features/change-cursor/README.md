# @rag/change-cursor

Spec: [docs/specs/feature/change-cursor.md](../../docs/specs/feature/change-cursor.md) (ticket #32, milestone M0).

The RAG server syncs documents from sources such as Drive and Slack. Three problems follow from that:

1. **Where did the last sync stop?** Each (tenant, source) pair keeps a cursor. A restart resumes from it.
2. **Did we already handle this event?** Sources deliver events more than once. `seen` drops the repeats, per tenant.
3. **What changed since we last looked?** The reconciliation sweep compares what we know with what the
   source lists now. `diffListing` returns the created, updated and deleted addresses.

The package holds all three. Durable state lives in one SQLite file, opened with the built-in
`node:sqlite`. The diff is pure logic with no I/O.

## Interface

```ts
export interface CursorStore {
  getCursor(tenantId: string, source: string): string | undefined;
  setCursor(tenantId: string, source: string, cursor: string): void;
  /** Atomically records the id for this tenant. Returns true if the tenant already saw it inside the ttl. */
  seen(tenantId: string, eventId: string): boolean;
}
export function createCursorStore(dbPath: string, clock: () => number, ttlMs?: number): CursorStore;
export function diffListing(known: Map<string, string>, listed: Map<string, string>): ListingDiff;
export interface ListingDiff {
  created: string[];
  updated: string[];
  deleted: string[];
}
export const CURSOR_MAX_CHARS = 4096; // longest cursor value, in code points
export const DEFAULT_TTL_MS = 86_400_000; // 24 hours
export class CursorError extends Error {
  readonly code: "INVALID_INPUT" | "CURSOR_TOO_LARGE";
}
```

### Cursors

- Keyed by `(tenantId, source)`. Writes overwrite. Tenants and sources never see each other's cursors.
- Keys and values may contain any unicode text. The value is stored as TEXT.
- `getCursor` returns `undefined` when nothing was ever set.

### Seen ids

- `seen(tenantId, id)` is `false` on first sight and `true` after that. Ids are scoped by tenant: tenant A's
- `forget(tenantId, id)` deletes the dedupe record, so call it when the handler for a seen event throws. Without it the retry would be dropped for the ttl.
  id never suppresses tenant B's. It stays `true` until `ttlMs` has passed,
  measured with the injected `clock`. After that, the next call returns `false` again and starts a new window.
- The check and the insert are one SQLite statement (`INSERT ... ON CONFLICT DO UPDATE ... WHERE expired`).
  Two handles on the same file cannot both see a fresh id as new.
- Every call first deletes expired rows (all tenants), so the table holds only ids inside the ttl.
- **Breaking change:** `seen(eventId)` became `seen(tenantId, eventId)`. On open, a legacy `seen_events` table
  without `tenant_id` is dropped and recreated; its rows were 24 h dedupe state, so at most one window of
  repeats can slip through once after upgrade.

### Diff

- Pure function. Neither input is modified.
- `created`: in `listed`, not in `known`. `deleted`: in `known`, not in `listed`, reported once.
  `updated`: in both, with different versions. Equal versions appear in no list.
- Each list is sorted by UTF-16 code unit order. Empty maps are allowed.

## Usage

```ts
import { createCursorStore, diffListing } from "@rag/change-cursor";

const store = createCursorStore("/var/lib/rag/cursors.db", Date.now);
const from = store.getCursor("tenant-1", "drive") ?? "";
// ... fetch the page after `from`, then:
store.setCursor("tenant-1", "drive", nextCursor);

for (const event of incoming) {
  if (store.seen("tenant-1", event.id)) continue; // duplicate inside 24 h
  try {
    handle(event);
  } catch (error) {
    store.forget("tenant-1", event.id); // release the id so the retry is not suppressed
    throw error;
  }
}

const { created, updated, deleted } = diffListing(knownVersions, listedVersions);
```

## Errors

Every rule the package enforces raises `CursorError` with a `code`:

| Code               | When                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`    | Empty or non-string tenant, source or event id; non-string cursor; ttl not a positive safe integer; clock not a function or returning a non-finite number; a diff input that is not a Map of non-empty string keys to string values |
| `CURSOR_TOO_LARGE` | Cursor value over 4096 code points                                                                                                                                                                                                  |

Storage failures from `node:sqlite` are not wrapped. They propagate unchanged.

## Limits and measured numbers

- Cursor value: at most 4096 code points. Exactly 4096 is accepted. Emoji count as one each.
- Event id: non-empty. No length cap, because the spec sets none.
- Expired seen rows are pruned on each `seen` call; no separate job is needed.
- `diffListing` on 100k known and 100k listed addresses: about 290 ms when timed alone in plain Node 26.
  The scale test asserts under 500 ms.
- The file opens in WAL mode with `busy_timeout = 5000` ms and `synchronous = NORMAL`. `NORMAL` can lose the
  last commits on power loss. It does not corrupt the file.
- The store has no `close()` method. Handles stay open until the process exits.

## Layout

```
src/
  index.ts     public exports
  store.ts     createCursorStore: the SQLite-backed cursors and seen ids
  diff.ts      diffListing: the pure reconciliation diff
  schema.ts    table DDL, limits, and the input checks that guard them
  errors.ts    CursorError and its codes
tests/
  unit/        diff, seen with a fake clock, errors; unit/cursor/ holds the cursor rules
  integration/ reopen survives, WAL mode, tenant scoping and pruning, worker threads racing on seen
  scale/       diff of 100k addresses, seen over 100k ids
```

## Test

```sh
pnpm --filter @rag/change-cursor test        # all tests, including scale
pnpm --filter @rag/change-cursor typecheck   # see the open issue below
pnpm --filter @rag/change-cursor mutation    # Stryker, break below 80
```

- The mutation run uses `vitest.stryker.config.ts`, which skips `tests/scale`. Under Stryker's
  instrumentation the timing test takes about 2.3 s, so it fails the 500 ms budget for reasons unrelated to the code.
- Tests write only under `os.tmpdir()`, in directories they create and delete.

## Open issues

- **Typecheck does not pass in this worktree.** `@types/node` is not resolvable from this package, so
  `node:sqlite`, `node:fs`, `node:os` and `node:path` fail with TS2307. Fixing it needs `@types/node` as a
  devDependency, which changes the root `pnpm-lock.yaml`. A scratch run with `@types/node@26.6.4` from another
  repo on this machine passes with exit 0.
- `@brain/core-types` is listed as a dependency but nothing imports it yet.
- `pnpm structure` cannot run. `tools/structure-lint` has only a README.
- `reports/mutation.json` is generated by the mutation run.
