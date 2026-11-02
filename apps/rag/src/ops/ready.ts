import { withTimeout } from "../runtime/timeouts.js";

/** The `/readyz` probe: the stores answer and, when the app has a model to load, it can load within `timeoutMs`. Throws when not ready. */
export function readiness(storesProbe: () => void, modelReady: (() => Promise<void>) | undefined, timeoutMs: number): () => Promise<void> {
  return async () => {
    storesProbe();
    if (modelReady) await withTimeout("embedder", timeoutMs, modelReady());
  };
}
