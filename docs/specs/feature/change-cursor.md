# Spec: change-cursor

Ticket: #32   Tier: feature   Milestone: M0 (used by M1)   Design cards: chg.trig, chg.flow

## Purpose
Remember where each source sync stopped, drop duplicate events, and find what changed when we
compare what we know with what the source lists now (the reconciliation sweep).
## Reuse decision
`node:sqlite` for durable state (embedded, built in). Later `pg-boss@12.38.0` runs the schedule.
Pure diff logic is ours (about 40 lines); no library does exactly this.
## Public interface
```ts
export interface CursorStore {
  getCursor(tenantId: string, source: string): string | undefined;
  setCursor(tenantId: string, source: string, cursor: string): void;
  seen(eventId: string): boolean; // atomically records the id; true if already seen inside the ttl
}
export function createCursorStore(dbPath: string, clock: () => number, ttlMs?: number): CursorStore; // ttl default 24h
export function diffListing(known: Map<string, string>, listed: Map<string, string>): { created: string[]; updated: string[]; deleted: string[] }; // maps are address -> version
```
## Behaviour
1. `seen` returns false the first time, true after, until ttl passes (injected clock), then false again.
2. Two concurrent `seen` calls for one id: exactly one returns false.
3. Cursors are per (tenant, source); overwrite wins; unicode keys work; value up to 4096 chars.
4. `diffListing`: pure, sorted output, empty maps allowed, identical maps give three empty lists, a deleted address is reported once.
5. 100k known addresses diff in under 500 ms.
## Acceptance tests (first)
unit (diff cases, ttl with fake clock), integration (reopen file db, state survives; two handles race on `seen`), mutation >= 80, scale (diff 100k, seen 100k ids).
## Layout
`features/change-cursor/src/{store.ts,diff.ts,schema.ts,index.ts}`.
## Out of scope
Webhook signature checks (svix, later), scheduling.
