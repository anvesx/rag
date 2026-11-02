# Source layout

- `types.ts`: event, result and dependency types, plus `IndexServiceError`.
- `service.ts`: `createIndexService`; upsert and delete flows, per-document serialisation.
- `index.ts`: public exports.
- `pipeline/`: the pre-fetched text check, the fetch/chunk/embed step, the chunk swap, and the keyed lock.

Spec: `docs/specs/service/index-service.md`.
