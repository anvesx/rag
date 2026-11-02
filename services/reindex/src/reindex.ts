import { createHash } from "node:crypto";
import type { Connector } from "@anvesx/connector-kit";
import { diffListing, type ListingDiff } from "@rag/change-cursor";
import type { Doc, RankIndex } from "@rag/rank";
import { assertToken } from "./token-error.js";

/** Narrows a document's readers. `tag` names what the gate decides on (such as the zone), so a change in it reindexes. */
export type Gate = ((doc: Doc) => Doc) & { tag?: (path: string) => string };
/** One document the caller's metadata source says is current: pointer, version and who may read it. No text. */
export type SourceDoc = { id: string; title: string; address: string; version: string; updatedAt?: string; readers: readonly string[] };
export type ReindexDeps = {
  /** Everything current at the source now. A document missing from here is treated as deleted. */
  docs: readonly SourceDoc[];
  connector: Connector;
  /** The asking user's token, handed to the connector for every fetch. */
  token: string;
  index: RankIndex;
  /** id to version of what the index holds now; updated in place. */
  known: Map<string, string>;
  gate?: Gate;
};

/** Rank refuses more than 10,000 documents per call, so a first reindex of a big corpus goes in slices. */
const BATCH = 5000;
const chunks = <T>(all: readonly T[]): T[][] => Array.from({ length: Math.ceil(all.length / BATCH) }, (_, i) => all.slice(i * BATCH, (i + 1) * BATCH));

/** Brings the rank index in line with `docs`: index created and updated documents, then drop deleted ones. */
export async function reindex(d: ReindexDeps): Promise<ListingDiff> {
  assertToken(d.token);
  const nodes = new Map(d.docs.map((n) => [n.id, n]));
  // The reader set is part of the tag, so an ACL change that leaves the source version alone still reindexes.
  const tag = (n: SourceDoc) => {
    const acl = createHash("sha256")
      .update(JSON.stringify([...n.readers].sort()))
      .digest("hex")
      .slice(0, 16);
    return [n.version, d.gate?.tag?.(n.address), acl].filter((p) => p !== undefined).join("|");
  };
  const versions = new Map([...nodes].map(([id, n]) => [id, tag(n)]));
  const diff = diffListing(d.known, versions);
  const docs: Doc[] = [];
  for (const id of [...diff.created, ...diff.updated]) {
    const n = nodes.get(id);
    if (n === undefined) continue;
    const { text } = await d.connector.fetch(n.address, { token: d.token });
    const mtime = Date.parse(n.updatedAt ?? "");
    const doc = {
      id,
      title: n.title,
      path: n.address,
      body: text,
      principals: [...n.readers],
      mtimeMs: Number.isFinite(mtime) ? mtime : 0,
      links: [],
    };
    docs.push(d.gate ? d.gate(doc) : doc);
  }
  // `known` changes only after both index steps committed, so a throw leaves the whole pass to retry.
  for (const part of chunks(docs)) d.index.index(part);
  for (const part of chunks(diff.deleted)) d.index.remove(part);
  for (const doc of docs) d.known.set(doc.id, versions.get(doc.id) as string);
  for (const id of diff.deleted) d.known.delete(id);
  return diff;
}
