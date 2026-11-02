# pipeline

- `listing.ts` wraps a connector to record one run's listing and whether it saw every page.
- `pointer.ts` builds the stable pointer id and the pointer from event, listing metadata and text hash.
- `reap.ts` sends delete events for known documents missing from a full listing and records failed deletes.
- `guard.ts` `reapSkip`: refuses a delete pass for an empty listing or a mass deletion.
