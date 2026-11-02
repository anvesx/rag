import { createEmbedder, DIMENSIONS } from "@rag/embedder";
import type { RagDeps } from "../types.js";

export type Embedding = Required<Pick<RagDeps, "embed" | "embedQuery" | "dimension">> & { ready: () => Promise<void> };

/**
 * The real local model (`@rag/embedder`, 384-D) as app deps. Nothing loads until the first embed or `ready()`;
 * `dimension` is the package constant, so startup never needs the model. `ready()` resolves once the model has
 * loaded, rejects while it cannot (a failed load is retried on the next call) and shares one in-flight attempt.
 */
export function realEmbedding(cacheDir?: string): Embedding {
  const embedder = createEmbedder(cacheDir ? { cacheDir } : {});
  let loaded = false;
  let attempt: Promise<void> | undefined;
  const ready = (): Promise<void> => {
    if (loaded) return Promise.resolve();
    attempt ??= embedder.embedQuery("readiness probe").then(
      () => {
        loaded = true;
        attempt = undefined;
      },
      (error: unknown) => {
        attempt = undefined;
        throw error;
      },
    );
    return attempt;
  };
  return { embed: (texts) => embedder.embed(texts), embedQuery: (text) => embedder.embedQuery(text), dimension: DIMENSIONS, ready };
}
