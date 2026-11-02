# Source layout

- `ingestion.ts` resolves the tenant's connector and credential, runs the connector runtime with a sink that applies upserts to the index service, then tombstones documents that vanished from a full listing. One run per tenant at a time.
- `errors.ts` `IngestionError` (`UNKNOWN_TENANT`).
- `types.ts` holds the public types.
- `index.ts` exposes the supported package API.
- `pipeline/` listing recorder, pointer builder, delete pass.

All runtime imports use ESM `.js` suffixes.
