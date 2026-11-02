# state

- `pending.ts` ids of events whose delivery is unconfirmed (cursor key `<connector>#inflight`)
- `failures.ts` per-event attempt counts and the quarantine list (keys `#attempts`, `#dead`)
- `identity.ts` event id from connector, address, version and canonical ACL
- `lock.ts` `createKeyedLock`: runs tasks with the same key one at a time
