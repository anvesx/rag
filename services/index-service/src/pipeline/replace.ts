import type { Acl, Pointer } from "@anvesx/core-types";
import type { SearchIndex } from "@rag/hybrid-search";
import type { Registry } from "@rag/pointer-registry";
import { IndexServiceError } from "../types.js";
import type { Row } from "./prepare.js";

type Stores = { registry: Registry; index: SearchIndex };

/** Access never widens on a failed update: keep only what both the old and the incoming ACL allow. */
function narrow(prior: Acl, next: Acl): Acl {
  const both = (a: string[], b: string[]) => a.filter((x) => b.includes(x));
  return {
    allowUsers: both(prior.allowUsers, next.allowUsers),
    allowGroups: both(prior.allowGroups, next.allowGroups),
    version: Math.max(prior.version, next.version),
  };
}

/**
 * Undo a failed event. The prior pointer comes back (so a replay retries), but with the narrowed ACL, in the
 * registry and in the index's own ACL copy, so a revocation is never undone. A brand new doc is tombstoned.
 */
export function restore({ registry, index }: Stores, prior: Pointer | undefined, p: Pointer): void {
  try {
    if (!prior) return void registry.tombstone(p.tenantId, p.id, p.updatedAt);
    const acl = narrow(prior.acl, p.acl);
    index.updateAcl(p.id, p.tenantId, acl);
    registry.upsert({ ...prior, acl });
  } catch (error) {
    throw new IndexServiceError("ROLLBACK_FAILED", error);
  }
}

/** A search validates the embedding first, so a wrong dimension fails before any chunk is removed. */
export function probe({ index }: Stores, row: Row | undefined): void {
  if (!row) return;
  try {
    index.search({ text: "x", embedding: row.embedding, limit: 1, acl: { sql: "0", params: [] } });
  } catch (error) {
    throw new IndexServiceError("EMBED_INVALID", error);
  }
}

/** Swap a doc's chunks in one atomic index call. On failure the old chunks are intact and the prior pointer is restored. */
export function replace(s: Stores, p: Pointer, rows: Row[], prior: Pointer | undefined): void {
  const chunks = rows.map(({ chunk, embedding }) => ({
    chunkId: chunk.id,
    docId: p.id,
    tenantId: p.tenantId,
    text: chunk.text,
    embedding,
    acl: p.acl,
  }));
  try {
    s.index.replace(p.id, p.tenantId, chunks);
  } catch (error) {
    restore(s, prior, p);
    throw new IndexServiceError("INDEX_FAILED", error);
  }
}
