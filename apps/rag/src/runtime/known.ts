import type { Registry } from "@rag/pointer-registry";

const PAGE = 1000;

/**
 * Ids of the tenant's live (not tombstoned) pointers, read page by page with `afterId` until exhausted.
 * With `source`, only pointers that source (connector id) wrote: ingestion deletes whatever this returns that a
 * listing lacks, so another source's documents must not be in it. An unmatched source (even "") yields nothing.
 */
export function liveIds(registry: Registry, tenantId: string, source?: string): string[] {
  const ids: string[] = [];
  for (let afterId: string | undefined; ; ) {
    const page = registry.list({ tenantId, limit: PAGE, ...(afterId !== undefined && { afterId }) });
    for (const pointer of page) if (pointer.deletedAt === null && (source === undefined || pointer.source === source)) ids.push(pointer.id);
    if (page.length < PAGE) return ids;
    afterId = page[page.length - 1]?.id;
  }
}
