# src

Source for `@rag/chunker`. Public entry is `index.ts`.

- `chunk.ts`: `chunkText` and the code-point splitter subclass. `chunkId` hashes the JSON tuple `[docId, index, text]`. Validates options, enforces the 50,000-chunk cap (estimate, plus a `RangeError` backstop), returns `[]` for blank text, splits, locates each piece, and builds chunks with ids.
- `offsets.ts`: `locate(text, pieces)`. Places each library piece in the source text by depth-first backtracking with a dead-state memo. A placement needs non-decreasing starts and ends and whitespace-only gaps, which holds for the library output, so a valid input always places. `OFFSET_LOST` is an internal-invariant error.
- `errors.ts`: `ChunkError` with codes `BAD_OPTIONS`, `OFFSET_LOST` and `TOO_MANY_CHUNKS`.
- `index.ts`: re-exports `chunkText`, `Chunk`, `ChunkOptions`, `ChunkError`, `ChunkErrorCode`.
