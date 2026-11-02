/** Binary-relevance metrics. `ranked` is a list of doc ids, best first; `relevant` is the labelled set. */

const gain = (rank: number): number => 1 / Math.log2(rank + 2);

export const ndcgAt = (ranked: readonly string[], relevant: ReadonlySet<string>, k = 10): number => {
  if (relevant.size === 0) return 0;
  let dcg = 0;
  ranked.slice(0, k).forEach((id, i) => {
    if (relevant.has(id)) dcg += gain(i);
  });
  let ideal = 0;
  for (let i = 0; i < Math.min(relevant.size, k); i++) ideal += gain(i);
  return dcg / ideal;
};

export const recallAt = (ranked: readonly string[], relevant: ReadonlySet<string>, k = 20): number => {
  if (relevant.size === 0) return 0;
  return ranked.slice(0, k).filter((id) => relevant.has(id)).length / relevant.size;
};

/** Reciprocal rank of the first relevant hit, 0 when none is returned. */
export const mrr = (ranked: readonly string[], relevant: ReadonlySet<string>): number => {
  const at = ranked.findIndex((id) => relevant.has(id));
  return at < 0 ? 0 : 1 / (at + 1);
};

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);
