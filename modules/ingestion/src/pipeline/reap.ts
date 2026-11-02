import type { IndexService } from "@rag/index-service";
import type { IngestionCounts } from "../types.js";

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Tombstones every known document the full listing no longer has. A failed delete is reported and retried next run. */
export async function reap(
  indexService: IndexService,
  tenantId: string,
  at: string,
  mine: Map<string, string>,
  listedIds: Set<string>,
  counts: IngestionCounts,
): Promise<void> {
  for (const [id, address] of [...mine]) {
    if (listedIds.has(id)) continue;
    counts.emitted++;
    try {
      await indexService.apply({ type: "delete", tenantId, id, at });
      mine.delete(id);
      counts.indexed++;
    } catch (error) {
      counts.failed++;
      counts.failures.push({ address, error: messageOf(error) });
    }
  }
}
