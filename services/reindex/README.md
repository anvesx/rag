# @rag/reindex

Brings a `@rag/rank` index in line with a metadata listing. The caller says which documents are current (`SourceDoc`: id, title, address, version, updated time, readers). `reindex` diffs that against what the index holds (`diffListing` from `@rag/change-cursor`), fetches the text of created and updated documents from the connector with the asking user's token, indexes them, and removes the deleted ones.

The listing can come from anywhere that holds metadata and ACLs: a connector listing, or the company-brain graph. This package never imports the graph. Moved from company-brain's `tools/integration` (its ADR 0006); the brain keeps the graph side.

## API

```ts
reindex({ docs, connector, token, index, known, gate? }): Promise<ListingDiff>
```

- `docs`: everything current now. A document missing from it counts as deleted.
- `token`: the asking user's token, passed to every `connector.fetch`. There is no default.
- `known`: id to version map of what the index holds, updated in place only after both index steps commit, so a throw leaves the whole pass to retry.
- `gate`: optional `(doc) => doc` that narrows readers. Its optional `tag(path)` joins the diffed version, so a change in what the gate decides reindexes an unedited document.

The diffed version is `version|gate tag|hash of the reader set`, so an ACL change that leaves a connector's version alone (Drive) still reindexes. Batches are 5,000 documents because rank refuses more than 10,000 per call.

## Tests

`pnpm --filter @rag/reindex test`. Real folder connector over a temp folder, real rank file in a temp directory. See [tests](tests/README.md).
