55%

# RAG

A standalone retrieval server for AI agents. It indexes documents from sources such as GitHub, Google Drive or a local folder. It answers search questions over the Model Context Protocol (MCP), the standard way agents call tools.

The server stores pointers, not copies. A pointer holds the source, the address and the access rules of a document. The text is fetched from the source when a question arrives, using the asking user's own credential.

## What it does

- Ingests documents from a connector and splits them into chunks.
- Embeds each chunk and indexes it for keyword and vector search.
- Serves an MCP search tool over HTTP or stdio.
- Checks the access rules of the asking user on every result, and can re-check each hit live at the source.
- Writes a tamper-evident audit row for every search.

## Quick start

You need Node 22 or newer and pnpm 8.15.

```bash
pnpm install
pnpm -r build
RAG_DEMO=1 RAG_PORT=3000 node apps/rag/dist/bin.js
```

The demo mode uses a toy embedder and an unsigned token. Do not expose it beyond loopback. Folder mode, real connectors, tokens and the full list of environment variables are in the [app guide](apps/rag/README.md).

## Layout

The repository is a pnpm and Turborepo workspace with four tiers. A package may depend only on tiers below it. `tools/structure-lint` enforces this.

| Tier     | Folder      | Role                                                                      |
| -------- | ----------- | ------------------------------------------------------------------------- |
| features | `features/` | Single-purpose libraries such as the chunker and the hybrid search index. |
| services | `services/` | Features wired into a service, such as indexing or querying.              |
| modules  | `modules/`  | Ingestion, retrieval and governance.                                      |
| apps     | `apps/rag`  | The runnable server.                                                      |
| tools    | `tools/`    | Lint, fake-guard, integration, end-to-end and load tests.                 |

Read [docs/architecture.md](docs/architecture.md) for the data flow.

## Shared contracts

Three packages come from outside this repository: `@anvesx/core-types`, `@anvesx/connector-kit` and `@anvesx/connectors`. They define the document, access-rule and connector types. Any host can consume this server alongside them. Company Brain is one such consumer. See [docs/shared-contracts.md](docs/shared-contracts.md) for how they are installed and what blocks a clean install today.

## Development

Rules: files under 80 lines, at most 5 files per folder, a guide file in every folder, tests next to the source, tests written first.

```bash
pnpm structure        # layout rules
pnpm guard:fakes      # no fakes in real-tier tests
pnpm lint             # Biome
pnpm typecheck
pnpm test
```

Lefthook runs these on commit and push. Never skip the hooks. See [docs/contributing.md](docs/contributing.md).

## License

MIT. See [LICENSE](LICENSE).
