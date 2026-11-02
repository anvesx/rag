import type { Pointer } from "@brain/core-types";
import { verifyContent } from "./pipeline/content.js";
import { createKeyedLock } from "./pipeline/lock.js";
import { prepare } from "./pipeline/prepare.js";
import { probe, replace, restore } from "./pipeline/replace.js";
import { type ApplyResult, type ChangeEvent, type Content, type IndexDeps, type IndexService, IndexServiceError } from "./types.js";

const text = (v: unknown): v is string => typeof v === "string" && v !== "";
const PASS = new Set(["INDEX_FAILED", "ROLLBACK_FAILED"]);

function keyOf(e: ChangeEvent): string {
  const [t, id] = e?.type === "upsert" ? [e.pointer?.tenantId, e.pointer?.id] : e?.type === "delete" ? [e.tenantId, e.id] : [];
  if (!text(t) || !text(id)) throw new IndexServiceError("INVALID_EVENT");
  return JSON.stringify([t, id]);
}

export function createIndexService(deps: IndexDeps): IndexService {
  const { registry, index } = deps;
  const lock = createKeyedLock();

  async function upsert(incoming: Pointer, content?: Content): Promise<ApplyResult> {
    // Verified before any state changes, so a bad body leaves the registry and the index untouched.
    const prefetched = content === undefined ? undefined : verifyContent(incoming, content);
    let prior: Pointer | undefined;
    let res: ReturnType<typeof registry.upsert>;
    try {
      prior = registry.get(incoming.tenantId, incoming.id);
      res = registry.upsert(incoming);
    } catch (error) {
      throw new IndexServiceError("INVALID_EVENT", error);
    }
    if (res.change === "unchanged") return { outcome: "unchanged", chunks: 0 };
    const p = res.pointer;
    try {
      const rows = await prepare(deps, p, prefetched);
      probe(deps, rows[0]);
      replace(deps, p, rows, prior);
      return { outcome: res.change, chunks: rows.length };
    } catch (error) {
      if (error instanceof IndexServiceError && PASS.has(error.code)) throw error;
      restore(deps, prior, p);
      throw error;
    }
  }

  function remove(tenantId: string, id: string, at: string): ApplyResult {
    try {
      index.remove(id, tenantId);
      return { outcome: registry.tombstone(tenantId, id, at) ? "deleted" : "absent", chunks: 0 };
    } catch (error) {
      const invalid = error instanceof Error && error.name === "RegistryError";
      throw new IndexServiceError(invalid ? "INVALID_EVENT" : "INDEX_FAILED", error);
    }
  }

  return {
    async apply(event) {
      const key = keyOf(event);
      return lock(key, async () => (event.type === "upsert" ? upsert(event.pointer, event.content) : remove(event.tenantId, event.id, event.at)));
    },
  };
}
