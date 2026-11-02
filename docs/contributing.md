# Contributing

## Tiers

The monorepo has four tiers. A package may depend only on tiers below it.

| Tier     | Packages                                    | Depends on                  |
| -------- | ------------------------------------------- | --------------------------- |
| features | acl-filter, audit-chain, chunker, etc.      | nothing                     |
| services | audit-service, index-service, etc.          | features                    |
| modules  | governance, ingestion, retrieval            | services, features          |
| apps     | rag                                       | modules, services, features |

Tools are leaf packages under `tools/`; they may depend on any tier below them.

## Creating a package

1. Create a folder in the appropriate tier root (e.g., `features/my-feature`).
2. Copy `package.json` and `tsconfig.json` from a sibling package and rename it.
3. Add `src/`, `tests/`, and `README.md`.

## File layout

- Files under `src/` and `tests/` are at most 80 lines.
- A folder holds at most 5 implementation files; README files are exempt.
- Every folder needs a `README.md` describing its contents.

## TDD workflow

1. Write the spec in `docs/specs/<tier>/<name>.md`.
2. Write failing tests first.
3. Implement code to pass tests.
4. Run `pnpm -r test` and the package's mutation script (Stryker breaks below a mutation score of 80).

## Commits and changesets

- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Each PR gets a changeset: `pnpm changeset`.
- Version bumps and changelog are generated automatically on release.

## Before pushing

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm integration
node tools/structure-lint/bin/cli.mjs
```
