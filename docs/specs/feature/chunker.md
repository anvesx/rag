# Spec: chunker

Ticket: #33   Tier: feature   Milestone: M0 (used by M2)   Design cards: idx.derive

## Purpose
Split document text into overlapping chunks with stable ids and exact offsets.
## Reuse decision
`@langchain/textsplitters@1.0.2` `RecursiveCharacterTextSplitter` does the splitting. We add stable
ids and verified offsets (the library does not return them) and the error contract.
## Public interface
```ts
export type Chunk = { id: string; docId: string; index: number; text: string; start: number; end: number };
export function chunkText(docId: string, text: string, opt?: { size?: number; overlap?: number }): Promise<Chunk[]>; // size 1000, overlap 100 chars
export class ChunkError extends Error { code: "BAD_OPTIONS" | "OFFSET_LOST" }
```
## Behaviour
1. `text.slice(start, end) === chunk.text` for every chunk. If an offset cannot be found, throw `OFFSET_LOST`, never guess.
2. `id = sha256(docId + ":" + index + ":" + text)` hex, so the same input gives the same ids.
3. Empty or whitespace-only text returns `[]`. `overlap >= size` or size < 1 throws `BAD_OPTIONS`.
4. Unicode: never cut a surrogate pair; CJK and emoji text round-trips.
5. 5 MB text chunks in under 3 s; chunks cover the whole text (union of ranges has no gap larger than the overlap rule allows).
## Acceptance tests (first)
unit (offset identity as a fast-check property, determinism, errors), integration (real markdown fixture, coverage check), mutation >= 80, scale (5 MB under 3 s).
## Layout
`features/chunker/src/{chunk.ts,offsets.ts,ids.ts,errors.ts,index.ts}`.
## Out of scope
Embeddings, contextual notes, PDF extraction.
