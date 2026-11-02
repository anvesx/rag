# Shared contracts

Three packages are published from another repository and consumed here as dependencies. They are never copied.

| Package | Role |
| --- | --- |
| `@anvesx/core-types` | Document, pointer, principal and access-rule types. |
| `@anvesx/connector-kit` | The connector interface and a fake connector for tests. |
| `@anvesx/connectors` | The GitHub and Drive connector adapters. |

The scope `@anvesx` belongs to the organization that publishes them. Every package in this repository uses the neutral scope `@rag`.

## Consuming the packages

The packages come from GitHub Packages. The committed `.npmrc` maps the `@anvesx` scope to `https://npm.pkg.github.com` and reads the token from `NODE_AUTH_TOKEN`. CI sets it from the repository secret `NPM_READ_TOKEN`, a classic token with `read:packages`. Locally, export a token with the same scope before `pnpm install`. Installs use `--frozen-lockfile` against the committed `pnpm-lock.yaml`.

To regenerate the lockfile, run the `lockfile` workflow (workflow_dispatch). It uploads the new `pnpm-lock.yaml` as an artifact.
