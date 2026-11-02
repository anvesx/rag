import { SearchError } from "./errors.js";

export type RankedId = { id: string; score: number };

export function rrf(lists: string[][], k = 60): RankedId[] {
  if (!Number.isFinite(k) || k < 0) throw new SearchError("INPUT");
  const scores = new Map<string, number>();
  for (const list of lists) {
    const seen = new Set<string>();
    list.forEach((id, index) => {
      if (seen.has(id)) return;
      if (typeof id !== "string" || id.length === 0) throw new SearchError("INPUT");
      seen.add(id);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((left, right) => right.score - left.score || (left.id < right.id ? -1 : 1));
}
