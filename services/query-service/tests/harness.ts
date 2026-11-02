import type { Pointer, Principal, Zone } from "@brain/core-types";
import { createSearchIndex } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import { createQueryService } from "../src/index.js";

export const alice: Principal = { id: "alice", tenantId: "t1", groups: ["eng"] };
export const person = (id: string, tenantId = "t1", groups: string[] = []): Principal => ({ id, tenantId, groups });

export type Doc = { id: string; tenantId?: string; zone?: Zone; users?: string[]; groups?: string[]; text?: string };

export function rig() {
  const index = createSearchIndex(":memory:", 2);
  const registry = createRegistry(":memory:");
  const service = createQueryService({ index, registry });
  const seed = (d: Doc): Pointer => {
    const tenantId = d.tenantId ?? "t1";
    const acl = { allowUsers: d.users ?? [], allowGroups: d.groups ?? [], version: 1 };
    index.add({ chunkId: `${d.id}-c1`, docId: d.id, tenantId, text: d.text ?? "needle", embedding: [1, 0], acl });
    const pointer: Pointer = {
      id: d.id,
      tenantId,
      source: "s",
      address: `s://${d.id}`,
      title: d.id,
      version: "v1",
      contentHash: "a".repeat(64),
      zone: d.zone ?? "team",
      acl,
      updatedAt: "2026-11-01T00:00:00Z",
      deletedAt: null,
    };
    return registry.upsert(pointer).pointer;
  };
  const ids = (principal: Principal, query = "needle", limit?: number) =>
    service.search({ query, principal, embedding: [1, 0], ...(limit === undefined ? {} : { limit }) }).map((p) => p.id);
  return { index, registry, service, seed, ids };
}
