/**
 * Reciprocal rank fusion (Cormack et al., SIGIR 2009): score(id) = sum over lists of 1 / (k + rank), rank from 1.
 * Uses ranks only, so BM25 and vector scores need no calibration. Pass lists that already passed the ACL pre-filter.
 */
export const rrf = (lists: readonly (readonly string[])[], k = 60): { id: string; score: number }[] => {
  if (!(k > 0) || !Number.isFinite(k)) throw new RangeError("rrf k must be a positive finite number");
  const scores = new Map<string, number>();
  for (const list of lists) {
    const seen = new Set<string>();
    list.forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
};
