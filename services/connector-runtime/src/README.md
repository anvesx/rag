# src

- `index.ts` public exports
- `runtime.ts` `createConnectorRuntime`: paging, per-tenant lock, cursor commit, BAD_CURSOR restart
- `deliver.ts` one item: dedupe, pending marker, sink call, retry count, quarantine
- `types.ts` `ChangeEvent`, `RuntimeDeps`, `RunResult`, `Failure`
- `errors.ts` `RuntimeError` and its codes
- `state/` pending markers, failure counts, event identity, keyed lock
