/** Public on purpose: only for a throwaway demo. Anyone holding an audit database signed with it can guess query text. */
export const DEMO_AUDIT_KEY = "demo-only-audit-key";
const MIN_KEY_CHARS = 32;

/**
 * The audit digest key. With `RAG_AUTH_SECRET` or `RAG_DATA_DIR` set (a persistent or signed deployment),
 * `RAG_AUDIT_KEY` of at least 32 characters is required and this throws without it. In pure demo mode a missing
 * key falls back to the public constant and `warn` is called.
 */
export function resolveAuditKey(env: Record<string, string | undefined>, warn: (msg: string) => void): string {
  const key = env.RAG_AUDIT_KEY;
  if (env.RAG_AUTH_SECRET !== undefined || env.RAG_DATA_DIR) {
    if (!key) throw new Error("RAG_AUDIT_KEY is required when RAG_AUTH_SECRET or RAG_DATA_DIR is set");
    if (key.length < MIN_KEY_CHARS) throw new Error(`RAG_AUDIT_KEY must be at least ${MIN_KEY_CHARS} characters`);
    return key;
  }
  if (key) return key;
  warn("rag: warning: RAG_AUDIT_KEY is not set; using the public demo audit key. Audit query digests are guessable. Demo only.");
  return DEMO_AUDIT_KEY;
}
