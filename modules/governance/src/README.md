# src

| File            | Job                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------- |
| `governance.ts` | `createGovernance`: search, record one audit row, return; `verify`; `checkpoint`.        |
| `digest.ts`     | `createTargetDigest`: per-tenant keyed HMAC of the query; throws `CONFIG` without a key. |
| `types.ts`      | `GovernanceDeps` and `Governance`.                                                       |
| `errors.ts`     | `GovernanceError` with codes `AUDIT` and `CONFIG`.                                       |
| `index.ts`      | Public exports.                                                                          |
