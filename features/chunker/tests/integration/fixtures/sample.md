# RAG: retrieval notes

RAG is a pointer-only knowledge index. It stores where a document lives, who may see it,
and a hash of its content. The text itself is fetched live, with the asking user's own token.

## Why chunks carry offsets

A citation must point at a span of text that still exists. A chunk therefore records its `start`
and `end` in the source document. Hydration re-finds the span in fresh text and marks the hit stale
when the span has moved.

Offsets are checked, never guessed. When a chunk cannot be located, the chunker raises
`OFFSET_LOST` and the caller decides what to do.

### Ids

- The id is `sha256(docId + ":" + index + ":" + text)`, hex encoded.
- The same document and the same text always give the same ids.
- A re-index after an edit changes only the ids of the chunks whose text changed.

## Splitting rules

1. Split on paragraphs first, then lines, then spaces.
2. Fall back to single characters only when a run has no separator at all.
3. Never cut a surrogate pair, so emoji and other astral characters stay whole.
4. Keep an overlap of about one hundred characters so a sentence that crosses a boundary is
   still searchable from both sides.

Empty documents and whitespace-only documents produce no chunks. They are not an error.

## Multilingual text

Teams write in many languages. The chunker treats every script the same way.

中文文档也需要被切分。每一段文字都要保留准确的位置信息，以便引用能够回到原文。
日本語の文書も同じように扱います。段落の区切りを優先し、文字の途中では切りません。
한국어 문서도 마찬가지입니다. 어절 단위로 나누고 원래 위치를 기록합니다.

Emoji status markers should survive splitting too: 🚀 shipped, ✅ reviewed, ⚠️ blocked, 📌 pinned.
Mixed runs such as 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 must not break inside a glyph.

## Operational limits

| Limit      | Value             | Why                                               |
| ---------- | ----------------- | ------------------------------------------------- |
| Chunk size | 1000 characters   | Fits one embedding call with headroom             |
| Overlap    | 100 characters    | Keeps boundary sentences searchable               |
| Text size  | 5 MB in under 3 s | Keeps a full re-index of a large export practical |

The chunker does not extract text from PDFs and does not create embeddings. A later stage owns
both jobs, and it receives the chunks as plain text with their offsets.

## Reading order

A reader who wants the full picture should read the spec first, then this note, then the
library evaluation. Each of the three documents is short. Together they explain what the chunker
promises and what it leaves to the next stage.

Lists, quotes and code are common in real notes, so this fixture keeps them too:

> A chunk that cannot prove where it came from is worse than no chunk at all.

```ts
const chunks = await chunkText("doc-1", text, { size: 1000, overlap: 100 });
```

The final paragraph exists so that the last chunk ends with ordinary words, not with a list
marker or a code fence. That keeps the coverage check honest at the end of the document.
