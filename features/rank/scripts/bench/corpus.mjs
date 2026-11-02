// Deterministic synthetic corpus and query stream for the latency bench.

export const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const VOCAB = 3000;
const GROUPS = 20;
// Rough Zipf: low ranks are far more common than high ranks, like real text.
const word = (r) => `w${Math.floor(VOCAB ** (r() ** 1.6)) - 1}`;
const words = (r, n) => Array.from({ length: n }, () => word(r)).join(" ");

export const makeDocs = (count, now) => {
  const r = rng(7);
  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}`,
    title: words(r, 5),
    path: `/space${i % 50}/${words(r, 2).replace(" ", "/")}-${i}.md`,
    body: words(r, 80),
    principals: [r() < 0.3 ? "company" : `group:${Math.floor(r() * GROUPS)}`],
    mtimeMs: now - Math.floor(r() * 400) * 86_400_000,
    links: Array.from({ length: Math.floor(r() * 4) }, () => `doc-${Math.floor(r() * count)}`),
  }));
};

export const makeQueries = (count) => {
  const r = rng(99);
  return Array.from({ length: count }, () => ({
    query: words(r, 1 + Math.floor(r() * 3)),
    principals: r() < 0.5 ? ["company", `group:${Math.floor(r() * GROUPS)}`] : [`group:${Math.floor(r() * GROUPS)}`],
  }));
};
