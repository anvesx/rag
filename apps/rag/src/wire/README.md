# src/wire

| File           | Job                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline.ts`  | `createPipeline`: builds query, audit, governance, index service and ingestion over the opened stores; returns ingest, search, verify and checkpoint. |
| `embedder.ts`  | `realEmbedding`: `@rag/embedder` as `embed`, `embedQuery`, `dimension` (384) and a shared, retried `ready()`.                                         |
| `dimension.ts` | `assertIndexDimension`: reads an existing `search.db` and throws `IndexDimensionError` when its vector size differs from the embedder's.              |
