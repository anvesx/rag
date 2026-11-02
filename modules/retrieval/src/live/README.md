# src/live

| File               | Job                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `connector-acl.ts` | `createConnectorLiveAcl`: a query-service `LiveAcl` that fetches each hit through the connector with the user's token. |

Verdicts: fetch succeeds is `allow`, `ConnectorError` `NOT_FOUND` and `FORBIDDEN` are `deny`, anything else (other errors, no token, no connector for the tenant,
unknown pointer) is `unknown`. It runs at most `concurrency` (default 8) fetches at once and passes the deadline `AbortSignal` to each. A connector without `enforcesUserToken: true` rejects with `CONFIG`. Query-service keeps only `allow`. It lives here, not in the app, so the integration tool can
use the same verifier. Cost: one full document fetch per hit.
