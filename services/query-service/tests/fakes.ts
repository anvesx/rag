import type { Pointer } from "@anvesx/core-types";
import type { Hit } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import { createQueryService, type QueryDeps } from "../src/index.js";

export const hit = (docId: string, n = 0): Hit => ({ chunkId: `${docId}-c${n}`, docId, score: 1 });
export type Call = { offset: number; limit: number };

/** Index fake that honours offset/limit over a fixed ranking; `ignoreOffset` mimics today's index. */
export function pagedIndex(hits: Hit[], opts: { failAt?: number; ignoreOffset?: boolean } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    search(q: { offset?: number; limit: number }): Hit[] {
      const offset = opts.ignoreOffset ? 0 : (q.offset ?? 0);
      calls.push({ offset: q.offset ?? 0, limit: q.limit });
      if (offset === opts.failAt) throw new Error("index down");
      return hits.slice(offset, offset + q.limit);
    },
  };
}

/** Real in-memory registry seeded with one pointer per entry, each allowing the listed users. */
export function registryOf(users: Record<string, string[]>) {
  const registry = createRegistry(":memory:");
  for (const [id, allowUsers] of Object.entries(users)) {
    const pointer: Pointer = {
      id,
      tenantId: "t1",
      source: "s",
      address: `s://${id}`,
      title: id,
      version: "v1",
      contentHash: "a".repeat(64),
      zone: "team",
      acl: { allowUsers, allowGroups: [], version: 1 },
      updatedAt: "2026-11-01T00:00:00Z",
      deletedAt: null,
    };
    registry.upsert(pointer);
  }
  return registry;
}
export const docs = (n: number, prefix = "d") => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(4, "0")}`);
export const grant = (ids: string[], user: string) => Object.fromEntries(ids.map((id) => [id, [user]]));

export const req = (limit?: number) => ({
  query: "x",
  principal: { id: "alice", tenantId: "t1", groups: [] },
  embedding: [1, 0],
  ...(limit === undefined ? {} : { limit }),
});
/** `hidden` leading docs belong to another user; the rest are visible to alice. */
export function pagedRig(total: number, hidden: number, extra: Partial<QueryDeps> = {}, opts = {}) {
  const ids = docs(total);
  const registry = registryOf({ ...grant(ids.slice(0, hidden), "zed"), ...grant(ids.slice(hidden), "alice") });
  const index = pagedIndex(
    ids.map((d) => hit(d)),
    opts,
  );
  return { index, registry, ids, service: createQueryService({ index, registry, ...extra }) };
}
