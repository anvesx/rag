import { createHmac } from "node:crypto";
import type { Pointer, Principal } from "@brain/core-types";
import { createGovernance } from "../../src/index.js";

export const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
export const ptr = (id: string): Pointer => ({
  id,
  tenantId: "t1",
  source: "s",
  address: `s://${id}`,
  title: id,
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  updatedAt: "2026-11-01T00:00:00Z",
  deletedAt: null,
});

export const auditKey = "test-master-key";

export type Call = { tenantId: string; event: { actor: string; action: string; target: string; detail?: Record<string, unknown> } };

/** Fake audit + query that log calls in one shared order list. */
export function fakes(results: Pointer[] = [ptr("d1"), ptr("d2")]) {
  const order: string[] = [];
  const calls: Call[] = [];
  const audit = {
    failWith: undefined as unknown,
    async record(tenantId: string, event: Call["event"]) {
      order.push("record");
      if (this.failWith !== undefined) throw this.failWith;
      calls.push({ tenantId, event });
      return { seq: calls.length, hash: "h" };
    },
    checkpoint: async (_t: string) => ({ seq: 7, hash: "cp" }),
    verify: async (_t: string) => ({ status: "ok" as const }) as { status: "ok" },
  };
  const query = {
    throwWith: undefined as unknown,
    search: (_r: unknown) => {
      order.push("search");
      if (query.throwWith !== undefined) throw query.throwWith;
      return results;
    },
  };
  return { order, calls, audit, query, gov: createGovernance({ audit, query, auditKey }) };
}
export const req = (query = "secret roadmap", principal: Principal = alice) => ({ query, principal, embedding: [1, 0] });

/** Independent re-statement of the digest: per-tenant key = HMAC(master, tenant), target = HMAC(tenant key, trimmed query). */
export const targetFor = (tenantId: string, query: string, master = auditKey): string => {
  const tenantKey = createHmac("sha256", master).update(`rag-audit-target-key:${tenantId}`).digest();
  return createHmac("sha256", tenantKey).update(query.trim(), "utf8").digest("hex");
};
