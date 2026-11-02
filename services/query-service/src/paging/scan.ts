import type { Pointer } from "@brain/core-types";
import type { Hit } from "@rag/hybrid-search";

export const PAGE_SIZE = 100;
export const DEFAULT_MAX_CANDIDATES = 1000;

export type ScanInput = {
  fetch(offset: number, limit: number): Hit[];
  /** Cached-ACL visibility: the registry pointer, or undefined when it must be hidden. */
  visible(docId: string): Pointer | undefined;
  limit: number;
  maxCandidates: number;
  /** Checked before each page; true ends the scan early (reported as truncated). */
  halt?: () => boolean;
};
export const ids = (batch: Pointer[]) => new Set(batch.map((p) => p.id));
export type ScanResult = { pointers: Pointer[]; truncated: boolean; scanned: number };

/**
 * Pages through the index. Yields each page's cached-visible pointers and expects the set of
 * ids that survived any further check sent back in. Pure: no IO other than the injected callbacks.
 */
export function* scan(input: ScanInput): Generator<Pointer[], ScanResult, Set<string>> {
  const { fetch, visible, limit, maxCandidates } = input;
  const docs = new Set<string>();
  const chunks = new Set<string>();
  const pointers: Pointer[] = [];
  let scanned = 0;
  while (pointers.length < limit) {
    if (scanned >= maxCandidates || input.halt?.()) return { pointers, truncated: true, scanned };
    const size = Math.min(PAGE_SIZE, maxCandidates - scanned);
    const hits = fetch(scanned, size);
    scanned += hits.length;
    const batch: Pointer[] = [];
    let advanced = false;
    for (const hit of hits) {
      if (!chunks.has(hit.chunkId)) advanced = true;
      chunks.add(hit.chunkId);
      if (docs.has(hit.docId)) continue;
      docs.add(hit.docId);
      const pointer = visible(hit.docId);
      if (pointer) batch.push(pointer);
    }
    if (batch.length > 0) {
      const kept = yield batch;
      for (const pointer of batch) if (kept.has(pointer.id) && pointers.length < limit) pointers.push(pointer);
    }
    // A short page or one with no new chunk means the index is exhausted (or ignores offset).
    if (hits.length < size || !advanced) return { pointers, truncated: false, scanned };
  }
  return { pointers, truncated: false, scanned };
}
