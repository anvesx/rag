import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Pointer, Principal } from "@brain/core-types";
import { createAuditChain } from "@rag/audit-chain";
import { createAuditService, createFileAnchorStore } from "@rag/audit-service";
import { createSearchIndex } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import { createQueryService } from "@rag/query-service";
import { afterAll } from "vitest";
import { createGovernance } from "../../src/index.js";

const dir = mkdtempSync(join(tmpdir(), "gov-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;

export const who = (id: string, tenantId = "t1"): Principal => ({ id, tenantId, groups: [] });
const pointer = (tenantId: string, acl: Pointer["acl"]): Pointer => ({
  id: `${tenantId}-d`,
  tenantId,
  source: "s",
  address: "s://x",
  title: "x",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl,
  updatedAt: "2026-11-01T00:00:00Z",
  deletedAt: null,
});

/** Real audit chain (file db) + file anchors + real query service over in-memory index and registry. */
export function rig() {
  const db = join(dir, `${n++}.db`);
  const index = createSearchIndex(":memory:", 2);
  const registry = createRegistry(":memory:");
  const chain = createAuditChain(db);
  const anchorStore = createFileAnchorStore(`${db}.anchors`);
  const audit = createAuditService({ chain, anchorStore, clock: () => new Date("2026-02-03T04:05:06.000Z") });
  const query = createQueryService({ index, registry });
  for (const tenantId of ["t1", "t2"]) {
    const acl = { allowUsers: [tenantId === "t1" ? "alice" : "zed"], allowGroups: [], version: 1 };
    index.add({ chunkId: `${tenantId}-c`, docId: `${tenantId}-d`, tenantId, text: "needle", embedding: [1, 0], acl });
    registry.upsert(pointer(tenantId, acl));
  }
  const gov = createGovernance({ audit, query, auditKey: "integration-key" });
  const go = (principal: Principal, q = "needle") => gov.search({ query: q, principal, embedding: [1, 0] });
  /** Tamper with the audit database behind the service's back. */
  const raw = (sql: string) => {
    const h = new DatabaseSync(db);
    h.exec("DROP TRIGGER audit_no_update");
    h.exec("DROP TRIGGER audit_no_delete");
    h.exec(sql);
    h.close();
  };
  return { chain, query, gov, go, raw };
}
