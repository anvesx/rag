# @rag/embedder

A real local embedding model for the rag: `Xenova/all-MiniLM-L6-v2` (384-D) run by
`@huggingface/transformers` 4.x (ONNX, in-process, no API key). Replaces the toy `[text.length, 1]`
embedder in `apps/rag/src/config.ts`. `apps/rag` uses it as the embedder in every non-demo mode.

```ts
import { createEmbedder } from "@rag/embedder";

const e = createEmbedder({ batchSize: 32, timeoutMs: 120000, cacheDir: "/var/cache/rag-models" });
const vectors = await e.embed(["chunk one", "chunk two"]); // number[][], each length 384, unit L2 norm
const q = await e.embedQuery("reset my password"); // number[]
```

`embed` and `embedQuery` match the fields of the same names on the app deps, and `embed` matches `IndexDeps.embed`.

## Behaviour

- Lazy: the model loads on the first call, once. A failed load (for example no network) is not cached, so the next call retries.
- Batches: `embed` sends `batchSize` texts per model call and returns vectors in input order. An empty array returns `[]`.
- Timeout: each call rejects after `timeoutMs`, model load included. The load itself keeps running and is reused.
- Vectors are mean-pooled and L2-normalised, so dot product equals cosine similarity.
- No query prefix: all-MiniLM-L6-v2 is symmetric, so `embedQuery` and `embed` share one path.

## Limits

- First use downloads about 23 MB from huggingface.co into the library cache. Pre-seed `cacheDir` for offline hosts.
- Text beyond the model's 256-token window is truncated by the tokenizer.

## Test

`pnpm test` runs the real model. If the model cannot be downloaded, set `RAG_EMBEDDER_OFFLINE=1` to skip
the model tests; they are skipped only on that variable, never silently.
