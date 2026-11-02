import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createAuditChain } from "@rag/audit-chain";
import { createCursorStore } from "@rag/change-cursor";
import { createSearchIndex } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import type { RagDeps } from "../types.js";

/**
 * Registry, search index, cursor store and audit chain: files under `dataDir` when set, otherwise in memory
 * (the audit chain always uses `auditDbPath`). `close` shuts every handle this opened, even if one throws;
 * a cursor store passed in by the caller stays the caller's to close.
 */
export function openStores(deps: Pick<RagDeps, "dataDir" | "cursors" | "clock" | "auditDbPath">, dimension: number) {
  const { dataDir } = deps;
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const at = (name: string) => (dataDir ? join(dataDir, name) : ":memory:");
  const registry = createRegistry(at("registry.db"));
  const index = createSearchIndex(at("search.db"), dimension);
  const owned = deps.cursors ? undefined : createCursorStore(at("cursors.db"), deps.clock);
  const chain = createAuditChain(deps.auditDbPath);
  const closers = [() => chain.close(), () => owned?.close(), () => index.close(), () => registry.close()];
  return {
    registry,
    index,
    chain,
    cursors: deps.cursors ?? (owned as NonNullable<typeof owned>),
    /** Cheap read from the registry: throws when its database is unreachable. */
    probe: () => void registry.list({ tenantId: "readyz", limit: 1 }),
    close(): void {
      const errors: unknown[] = [];
      for (const closeOne of closers) {
        try {
          closeOne();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw errors[0];
    },
  };
}
