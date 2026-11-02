# @rag/connector-runtime

Spec: [docs/specs/service/connector-runtime.md](../../docs/specs/service/connector-runtime.md).

Polls one connector for a tenant and delivers each document change to an injected sink exactly once.
Depends only on `@anvesx/connector-kit`, `@rag/change-cursor` and `@anvesx/core-types`.

## Interface

```ts
const runtime = createConnectorRuntime({ connector, cursors, sink, clock, pageSize });
const { emitted, skipped, restarted, failures, quarantined } = await runtime.runOnce("tenant-1");
```

- `sink(event)` receives `ChangeEvent` (`tenantId`, `connectorId`, `address`, `version`, `title`, `emittedAt`).
- Event identity is `(tenant, connector, address, version, ACL)`. The ACL is canonical: user and group lists are compared as sets, plus the ACL version. A new version or a changed ACL emits once more.
- `RuntimeError.code`: `INVALID_INPUT`, `BAD_CURSOR_LOOP`. A sink rejection is not thrown: it lands in `failures` as `{address, error}`.
  Connector and store errors propagate unchanged.

## Behaviour

- Cursor key is `(tenant, connector.id)`. It advances page by page, so a crash resumes at the last committed page.
  A finished scan stores `""`, so the next run starts from the first page and dedupe drops the unchanged items.
- A sink failure does not stop the run. The failed event is reported in `failures`, later items and pages still run, and the
  cursor is reset to `""` and stays there, so the next run re-lists the whole source (delete detection needs the full listing).
  Because `seen()` cannot be undone, each item first adds its id to a pending list (cursor key `<connector.id>#inflight`);
  a retry of a pending event bypasses `seen()`. Delivery is at-least-once for the failed event, never lost, and never repeated
  once the sink succeeded.
- Retry bound: an event that fails `maxAttempts` runs (default 3) is quarantined. It is skipped from then on and returned in `quarantined`
  on every run. A new version or ACL for the address is a new event and is tried again; its delivery clears the old entry.
- Runs for the same tenant and connector on one cursor store are serialised by a lock; a concurrent `runOnce` waits for the running one.
- `BAD_CURSOR` resets the cursor and rescans from the start once. A second `BAD_CURSOR` raises `BAD_CURSOR_LOOP`.
- Tenants never share cursors, markers or seen ids.

## Limits

- `pageSize` integer 1-1000, default 100.
- Cost per item is up to 3 SQLite writes (marker, seen, marker clear). Not benchmarked.
- The lock is in-process. Two processes sharing one database are not excluded.
- Retry counts and the quarantine list are cursor values (4096-char cap): the quarantine keeps the newest 20 entries, 60 chars of each error.
  A quarantined document deleted from the source stays listed until a later version of that address is delivered.
- Upgrading from the version-only identity re-emits every document once.
- Seen ids expire after the store's ttl (24 h default). An unchanged document is re-emitted by a scan after expiry.

## Test

```sh
pnpm --filter @rag/connector-runtime test
pnpm --filter @rag/connector-runtime typecheck
```
