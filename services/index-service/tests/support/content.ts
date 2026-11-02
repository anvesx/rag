import { pointer, sha } from "./harness.js";

export const withText = (text: string, over = {}) => ({
  type: "upsert" as const,
  pointer: pointer({ contentHash: sha(text), ...over }),
  content: { text, contentHash: sha(text) },
});
export const fail = async (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e) => (e as { code?: string }).code,
  );
