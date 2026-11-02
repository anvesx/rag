# @rag/retrieval

One call that wires `@rag/query-service` into `@rag/mcp-service`. Spec: `docs/specs/module/retrieval.md`.

```ts
import { createRetrieval } from "@rag/retrieval";

const retrieval = await createRetrieval({
  index, // @rag/hybrid-search index
  registry, // @rag/pointer-registry registry
  principalFor: (extra) => principalFromAuthHeader(extra), // throws when unauthenticated
  embedQuery: async (text) => embed(text), // same model and dimension as the index
  audit, // REQUIRED: @rag/audit-service; every search writes a row before results return
  auditKey: process.env.AUDIT_KEY, // REQUIRED non-empty master secret for the keyed target digest
  transport: "http", // or "stdio"
  port: 0, // http only; read retrieval.port
});
await retrieval.close();
```

## Behaviour

1. The MCP `search` tool validates and trims the request (bad input is rejected before any embedding), embeds the trimmed query with `embedQuery`, then calls the query service with the caller's principal.
2. ACL, tenant and tombstone enforcement is the query service's job; hidden documents are never returned.
3. Unauthenticated HTTP requests get `401` from the MCP service.
4. Audited and fail closed: after the query runs, one row `{ actor, action: "search", target, detail: { count } }` is written under the caller's tenant, then results return. If the write fails, the search fails and no pointers are returned.
5. `target` is `HMAC-SHA256(HMAC-SHA256(auditKey, tenant), trimmed query)`. The raw query is never stored. Same digest as `@rag/governance`.
6. Missing `audit` or empty `auditKey` throws `RetrievalError` `CONFIG` at construction (`createRetrieval` rejects). Nothing is served unaudited.
7. An `embedQuery` failure, a wrong-dimension vector, any query-service error, or an audit failure becomes the MCP error `Search failed`. The cause goes only to the optional `logger`. Searches that fail for these reasons leave no row; only a `LIVE_ACL` refusal writes a failure row (step 10).

8. Search runs through the query service's `searchLive`, which pages the index with `offset` (up to `maxCandidates`, default 1000) and applies the optional `liveAcl` verifier (options `liveAcl`, `liveAclTimeoutMs`, `timer`, `maxCandidates` pass straight to the query service).
9. `retrieval.search(request)` is the audited typed path the MCP tool uses. It resolves `{ ok: true, pointers, truncated, scanned, liveDenied, liveUnverified, degraded? }`, or `{ ok: false, code: "LIVE_ACL" }` when the verifier errored, timed out or could not vouch for any hit. `truncated` means the scan hit its candidate cap, so more matches may exist. `degraded: true` marks results that survived while `liveUnverified > 0` (a partial live ACL outage); callers should not treat them as complete.
10. Fail closed: a `LIVE_ACL` outcome returns no pointers, writes one audit row (`detail: { count: 0, outcome: "failure", code: "LIVE_ACL" }`; if that write fails the request fails with `AUDIT`), and reaches MCP clients as `Search failed`. Over MCP, `truncated` is not exposed (the tool returns pointers only); read it from `retrieval.search`.

11. `createConnectorLiveAcl({ connectorFor, userTokenFor, pointerFor })` is a ready `liveAcl` for step 8: it fetches each hit through the tenant's connector with the user's own token (success `allow`, `NOT_FOUND` `deny`, anything else `unknown`; `FORBIDDEN` also `deny`). Fetches run in a pool (`concurrency`, default 8), receive the search deadline's `AbortSignal`, and stop starting once it aborts. A connector without `enforcesUserToken: true` makes the verifier reject with `RetrievalError` `CONFIG` (query-service then fails closed). Pass it as the `liveAcl` option.

`@rag/governance` cannot be imported here (modules do not depend on modules), so the audit wrapper in `src/audit.ts` is a small deliberate copy of its logic.

## Limits

Embedding runs in the caller's function; this module ships no model. The tool caps `limit` at 50 and the query at 2000 characters.

## Test

`pnpm test`, `pnpm typecheck`, `pnpm mutation` from this folder. Tests use in-memory databases and a real HTTP MCP client. Build the dependencies first (core-types, acl-filter, hybrid-search, pointer-registry, mcp-search-tool, query-service, mcp-service).
