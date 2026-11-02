# @rag/chunker

Splits document text into overlapping chunks. Each chunk has a stable id and exact offsets into the source text, so a caller can always recover the chunk from the document: `text.slice(chunk.start, chunk.end) === chunk.text`.

Spec: `docs/specs/feature/chunker.md`.

## What it does

`chunkText(docId, text, options?)` returns `Promise<Chunk[]>`:

```ts
type Chunk = { id: string; docId: string; index: number; text: string; start: number; end: number };
```

- `id` is `sha256(JSON.stringify([docId, index, text]))` as hex. JSON quoting makes the tuple unambiguous, so `("a:1", 0, "x")` and `("a", 1, "0:x")` no longer collide. The same input always gives the same ids. Format change: ids differ from the old `docId:index:text` hash, so re-chunk and re-index existing documents.
- `index` runs `0..n-1` in document order.
- `start` and `end` are UTF-16 offsets into the input `text`.
- Empty or whitespace-only text returns `[]`.
- Chunks never cut a surrogate pair, so emoji and CJK text round-trip.

Splitting is delegated to `@langchain/textsplitters` `RecursiveCharacterTextSplitter`. The library does not return offsets, so this package adds them and verifies every one. A subclass overrides the library's per-separator split so that the `""` separator splits by code point, not UTF-16 unit. Without that override the library can split a surrogate pair.

## Options

| Option    | Default | Rule                          |
| --------- | ------- | ----------------------------- |
| `size`    | 1000    | integer >= 1, in UTF-16 units |
| `overlap` | 100     | integer in `[0, size)`        |

A document may produce at most 50,000 chunks. The count is estimated before splitting as `ceil((length - overlap) / (size - overlap))`; above the cap, `chunkText` throws `TOO_MANY_CHUNKS`. Without a cap, options such as size 50, overlap 49 give about one chunk per character, and the library overflows the stack (`RangeError`) near 100,000 chunks. A stack overflow from the library is also converted to `TOO_MANY_CHUNKS`. I kept overlap in `[0, size)` rather than capping it at size/2, because a small document with high overlap is valid; the count cap bounds the cost instead.

Invalid options throw `ChunkError` with code `BAD_OPTIONS`. The message names the bad option (`size` or `overlap`). `docId` and `text` must be strings.

Gotcha: the default overlap is 100. If you pass `size` below 101 without an `overlap`, the call throws `BAD_OPTIONS`. Pass both options for small sizes, for example `{ size: 50, overlap: 10 }`.

## Errors

`ChunkError` extends `Error` and carries `code`:

- `BAD_OPTIONS`: wrong types or out-of-range `size` or `overlap`.
- `TOO_MANY_CHUNKS`: the document would exceed 50,000 chunks. Raise `size` or lower `overlap`.
- `OFFSET_LOST`: a chunk's text could not be placed in the source. The function throws. It never returns a guessed offset.

## Usage

```ts
import { chunkText, ChunkError } from "@rag/chunker";

try {
  const chunks = await chunkText("doc-42", markdown, { size: 800, overlap: 80 });
  for (const c of chunks) {
    console.log(c.index, c.start, c.end, c.id);
  }
} catch (err) {
  if (err instanceof ChunkError && err.code === "BAD_OPTIONS") {
    // fix the caller's options
  }
  throw err;
}
```

## Layout

- `src/chunk.ts`: `chunkText`, `chunkId`, the chunk cap, the splitter subclass, option resolution.
- `src/offsets.ts`: `locate`, which places library pieces in the source text by backtracking.
- `src/errors.ts`: `ChunkError` and its codes.
- `src/index.ts`: the public exports.

See `src/README.md` for the file-level notes.

## Limits

- Offsets are UTF-16 units, matching `String.prototype.slice`.
- Placement is a complete search, not a heuristic. `locate` backtracks over candidate occurrences of each library piece, requiring starts and ends not to decrease and only whitespace between pieces. A 200000-run fast-check sweep over a whitespace-heavy alphabet found no failure. `OFFSET_LOST` remains only as an internal-invariant error.
- Performance: 5 MB of text splits in about 150 ms on the dev machine, under the 3 s budget.
- Out of scope: embeddings, contextual notes, PDF extraction.

## Testing

Run from this folder:

- `pnpm test`: unit, integration and scale tests (Vitest).
- `pnpm typecheck`: strict TypeScript, no emit.
- `pnpm mutation`: Stryker mutation run with the Vitest runner. Break threshold 80. Last run: 84.57.

Tests:

- `tests/unit/`: errors, ids, offsets, and the fast-check offset identity property (300 runs). `tests/unit/chunk/`: chunk behaviour by topic, plus the small-alphabet property (3000 runs) and its regressions.
- `tests/integration/`: a real markdown fixture with CJK, emoji, a table and code.
- `tests/scale/`: 5 MB input, under 3 s, with identity and coverage; the chunk count cap.
- `tests/support/`: shared assertions (`expectIdentity`, `uncoveredNonSpace`, `hasLoneSurrogate`).
