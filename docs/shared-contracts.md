# Shared contracts

Three packages are published from another repository and consumed here as dependencies. They are never copied.

| Package | Role |
| --- | --- |
| `@brain/core-types` | Document, pointer, principal and access-rule types. |
| `@brain/connector-kit` | The connector interface and a fake connector for tests. |
| `@brain/connectors` | The GitHub and Drive connector adapters. |

The scope `@brain` belongs to the repository that publishes them, so these names stay as they are. Every package in this repository uses the neutral scope `@rag`.

## Current state

The package manifests declare version 0.1.0 for all three. That version is not published yet, so a plain install fails. The registry decision is pending. GitHub Packages is the recommended target, and the repository's npm configuration already points the @brain scope at it.

Installing straight from git does not work, for two reasons.

1. pnpm 8.15 cannot read a subfolder spec such as the core-types path on the company-brain repository. It fails with "Could not resolve path:/features/core-types to a commit".
2. pnpm 10 reads the subfolder, then fails with ERR_PNPM_WORKSPACE_PKG_NOT_FOUND for the core-types dependency. The packages depend on each other through the workspace protocol, and they have no committed build output.

## Local development

Until the registry exists, link a checkout of the other repository. Add a gitignored pnpmfile at the repository root. It rewrites the three dependencies to local link paths. Build the three packages in that checkout first, then install.
