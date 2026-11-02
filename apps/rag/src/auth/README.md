# src/auth

| File           | Job                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claims.ts`    | Token wire format: legacy `user:tenant:exp:sig` and `user:tenant:exp:groups:kid:sig` (signed groups, optional kid); HMAC-SHA256, constant-time compare. |
| `mint.ts`      | `mintToken`: default lifetime 1 h, refuses a lifetime above the maximum.                                                                                |
| `token.ts`     | `signedPrincipalFor`, `TokenPolicy` (extra keys by kid, max lifetime), `TokenExpiredError`. Groups come only from the signed token.                     |
| `mode.ts`      | `requireAuthMode`: unsigned tokens only when `RAG_DEMO=1` and the host is loopback. `readTokenPolicy`: `RAG_AUTH_KEYS`, `RAG_TOKEN_MAX_TTL_SECONDS`.    |
| `audit-key.ts` | `resolveAuditKey`: requires `RAG_AUDIT_KEY` in persistent or signed mode; demo fallback with a warning.                                                 |
