# Architecture

The server answers one question: which passages answer this query, for this user.

## Two paths

**Ingest** brings documents into the index.

1. A connector lists documents and reports changes since its last cursor.
2. The connector runtime deduplicates events and saves the cursor.
3. The index service stores a pointer, then chunks, embeds and indexes the text.

**Search** answers a query.

1. A client calls the MCP search tool with a signed bearer token.
2. The query service runs hybrid (keyword plus vector) search and filters by the user's access rules.
3. Optionally, each hit is re-checked at the source with the user's own credential. Any failure drops the hit.
4. Governance writes one audit row, chained so tampering is detectable.

## Stores

The pointer registry, the search index (SQLite with FTS5 and vectors), the cursor store and the audit database are separate SQLite files under `RAG_DATA_DIR`. Without that variable they live in memory.

## Packages

| Tier | Packages |
| --- | --- |
| features | acl-filter, audit-chain, change-cursor, chunker, hybrid-search, mcp-search-tool, pointer-registry, rank |
| services | audit-service, connector-runtime, embedder, index-service, mcp-service, query-service, reindex |
| modules | ingestion, retrieval, governance |
| app | apps/rag |

Each package has a spec under [specs/](specs/).

## Boundaries

The server does not own a document graph or any connector adapters. Connectors implement the `connector-kit` contract and live outside this repository. A host application can run a graph store of its own next to this server. The two never share a database.
