import type { Doc } from "../../src/index.js";

export type Weights = { title: number; path: number; body: number };
export const NOW = Date.UTC(2026, 10, 2);
const DAY = 86_400_000;
const tokens = (s: string): string[] =>
  s
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean);
const count = (list: string[], t: string): number => list.filter((x) => x === t).length;

/** Brute force: scan everything, drop what the asker cannot read, then rank the rest. Written from the spec, not from src. */
export const oracle = (
  docs: readonly Doc[],
  principals: readonly string[],
  query: string,
  k: number,
  now = NOW,
  w: Weights = { title: 3, path: 2, body: 1 },
) => {
  const latest = [...new Map(docs.map((d) => [d.id, d])).values()];
  const vis = latest.filter((d) => d.principals.some((p) => principals.includes(p)));
  const terms = [...new Set(tokens(query.slice(0, 10_000)))].slice(0, 32);
  const field = (d: Doc) => ({ title: tokens(d.title), path: tokens(d.path), body: tokens(d.body) });
  const f = new Map(vis.map((d) => [d.id, field(d)]));
  const avg = (c: keyof Weights) => vis.reduce((s, d) => s + f.get(d.id)![c].length, 0) / (vis.length || 1);
  const av = { title: avg("title"), path: avg("path"), body: avg("body") };
  const cols = ["title", "path", "body"] as const;
  const idf = (t: string) => {
    const df = vis.filter((d) => cols.some((c) => count(f.get(d.id)![c], t) > 0)).length;
    return Math.log(1 + (vis.length - df + 0.5) / (df + 0.5));
  };
  const idfs = new Map(terms.map((t) => [t, idf(t)]));
  const hits = vis.flatMap((d) => {
    const fd = f.get(d.id)!;
    let text = 0;
    for (const t of terms) {
      const tf = cols.reduce((s, c) => (av[c] === 0 ? s : s + (w[c] * count(fd[c], t)) / (1 - 0.75 + (0.75 * fd[c].length) / av[c])), 0);
      text += (idfs.get(t)! * tf) / (1.2 + tf);
    }
    if (text === 0) return [];
    const inbound = vis.filter((s) => s.id !== d.id && s.links.includes(d.id)).length;
    const recency = 0.5 ** (Math.max(0, now - d.mtimeMs) / (90 * DAY));
    const links = Math.log(1 + inbound);
    return [{ id: d.id, path: d.path, score: text * (1 + 0.2 * recency + 0.1 * links), signals: { text, recency, links } }];
  });
  return hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, k);
};
