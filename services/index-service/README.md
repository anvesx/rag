# @rag/index-service

Applies change events to the search index. Spec: `docs/specs/service/index-service.md`.

```ts
import { createIndexService } from "@rag/index-service";

const svc = createIndexService({ registry, index, chunk, embed, fetchText }); // fetchText is optional
await svc.apply({ type: "upsert", pointer }); // { outcome: "created" | "updated" | "unchanged", chunks }
await svc.apply({ type: "upsert", pointer, content: { text, contentHash } }); // text already fetched: no fetchText call
await svc.apply({ type: "delete", tenantId, id, at }); // { outcome: "deleted" | "absent", chunks: 0 }
```

`registry` is `@rag/pointer-registry`, `index` is `@rag/hybrid-search`, `chunk(docId, text)` is
`chunkText` from `@rag/chunker` (or a wrapper with options). `embed(texts)` and `fetchText(pointer)`
are injected, so the service does no network I/O of its own. `fetchText` is optional: without it, every
upsert that needs indexing must carry `content`, else `INVALID_EVENT` (the registry row is restored, so a replay
with content succeeds). `unchanged` upserts and deletes never need it.

## Behaviour

- Upsert: the registry decides. `unchanged` does nothing (no fetch, no embed). `created` or `updated`
  fetches text, chunks, embeds, then replaces the document's chunks with one atomic `index.replace(id, tenantId, chunks)`.
  An ACL change makes the pointer `updated`, so chunk ACL columns are rewritten with the new ACL.
- Fetched text: the text returned by `fetchText` must hash (sha-256 hex of the UTF-8 text) to `pointer.contentHash`, else
  `HASH_MISMATCH`. This catches a source that changed between list and fetch. The check runs before chunk, embed and any index
  write; the registry row written for the event is restored like any other failure (prior pointer, ACL narrowed), so
  the stale body is never indexed under the new pointer.
- Pre-fetched text: an upsert may carry `content: { text, contentHash }`. Then `fetchText` is not called. Before
  anything changes, `contentHash` must equal `pointer.contentHash` and `text` must hash to it (sha-256 hex of the
  UTF-8 text), else `HASH_MISMATCH` and the registry and index are untouched. A non-string `text` or `contentHash`
  is `INVALID_EVENT`. Without `content` the service fetches as before. `unchanged` ignores `content`.
- Delete: chunks are removed first, then the pointer is tombstoned. Deleting an unknown or already
  deleted doc returns `absent` and still removes any stray chunks, so replay is safe.
- Everything is keyed by `(tenantId, id)`. The same `id` in two tenants never mixes.
- Events for one `(tenantId, id)` run one at a time in arrival order; others run in parallel. The lock has no
  timeout (a hung task blocks its own key only) and releases its key map entry when idle (`pending()` is 0).
- Replaying any event stream converges to the same state.

## Failure model

The pointer is written before the slow work, so every failure before the chunk swap restores the
previous registry row (or tombstones a brand new one). Old chunks are never touched.

Permission revocation survives failure: the restored row carries the intersection of the old and incoming
ACL, written to the registry and to the index ACL copy (`index.updateAcl`). A failed fetch can narrow
access to stale chunks but never widen it, and the replay still sees the doc as changed. Fetch, chunk and
embed failures, wrong vector count, ragged or non-finite vectors, and a vector dimension the index
rejects (probed with a read-only search) all end this way. Replaying the same event then retries.

A failed chunk swap is no different: `index.replace` is atomic, so if adding the new chunks fails (disk full, duplicate chunk
id) the old chunks stay searchable, the prior pointer is restored with the narrowed ACL, and the error is `INDEX_FAILED`. A
replay retries. A brand new doc that fails is tombstoned and has no chunks.

Errors are `IndexServiceError` with `code`: `INVALID_EVENT`, `HASH_MISMATCH`, `FETCH_FAILED`, `CHUNK_FAILED`,
`EMBED_FAILED`, `EMBED_INVALID`, `INDEX_FAILED`, `ROLLBACK_FAILED`. The original error is in `cause`.

## Limits

- Serialisation is in-process. Two processes writing the same database file can interleave.
- The registry stores pointers only; the index keeps tokens and ACLs only (no body text), so text is re-fetched from the source unless the caller passes it as `content`.

## Test

`pnpm test`, `pnpm typecheck`, `pnpm mutation` from this folder.

Mutation score is 97.87 with five surviving mutants, each equivalent (no observable behaviour change):

- `prepare.ts` `if (prefetched === undefined) verifyFetched(...)` forced to `true`: prefetched text was already verified by `verifyContent`, so a second check passes.
- `prepare.ts` `typeof x === "number"` replaced by `true`: `Number.isFinite` does not coerce, so it already returns false for every non-number.
- `prepare.ts` `vectors[0]?.length`: `checkEmbeddings` runs only when there is at least one chunk, so `vectors[0]` always exists.
- `replace.ts` probe text `"x"` replaced by `""`: the probe only validates the embedding dimension and the ACL matches nothing, so the query text is never used.
- `service.ts` fallback `[]` in `keyOf` replaced by a one-element array: `id` stays undefined, so the event is rejected as `INVALID_EVENT` either way.
