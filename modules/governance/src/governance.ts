import type { Pointer } from "@brain/core-types";
import type { SearchRequest } from "@rag/query-service";
import { createTargetDigest } from "./digest.js";
import { GovernanceError } from "./errors.js";
import type { Governance, GovernanceDeps } from "./types.js";

async function audited<T>(what: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (cause) {
    throw new GovernanceError("AUDIT", `audit ${what} failed`, { cause });
  }
}

export function createGovernance({ audit, query, auditKey }: GovernanceDeps): Governance {
  const digest = createTargetDigest(auditKey);
  return {
    async search(request: SearchRequest): Promise<Pointer[]> {
      // Query errors pass through and leave no row; results are held back until the audit row is written.
      const results = await query.search(request);
      const { id, tenantId } = request.principal;
      await audited("record", () =>
        audit.record(tenantId, { actor: id, action: "search", target: digest(tenantId, request.query), detail: { count: results.length } }),
      );
      return results;
    },
    verify: (tenantId) => audited("verify", () => audit.verify(tenantId)),
    checkpoint: (tenantId) => audited("checkpoint", () => audit.checkpoint(tenantId)),
  };
}
