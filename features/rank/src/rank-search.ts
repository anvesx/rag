import type { DatabaseSync } from "node:sqlite";
import type { Cols, Hit, Probe } from "./model/types.js";
import { readInbound, readMeta, readPostings, readStats } from "./store/read.js";
import { readTx } from "./store/tx.js";
import { combine, idf, linkSignal, recency, type TermStat, textScore } from "./text/formula.js";
import type { Keyer } from "./text/keyed.js";
import { queryTerms } from "./text/tokenize.js";

const COL = { t: "title", p: "path", b: "body" } as const;
const byScore = (a: Hit, b: Hit): number => b.score - a.score || (a.id < b.id ? -1 : 1);

type Ctx = { principals: string[]; k: number; now: number; weights: Cols; term: Keyer; probe?: Probe | undefined };

/** Rank visible docs for one query. Every statement carries the ACL filter; nothing is dropped afterwards. */
export const rankSearch = (db: DatabaseSync, query: string, c: Ctx): Hit[] => {
  let last = performance.now();
  const lap = (stage: string): void => {
    const t = performance.now();
    c.probe?.(stage, t - last);
    last = t;
  };
  const terms = queryTerms(query).map(c.term);
  lap("terms");
  if (terms.length === 0) return [];
  const p = JSON.stringify(c.principals);
  return readTx(db, () => {
    const stats = readStats(db, p);
    lap("stats");
    if (stats.n === 0) return [];
    const postings = readPostings(db, p, JSON.stringify(terms));
    lap("postings");
    const perDoc = new Map<number, Map<string, Cols>>();
    const df = new Map<string, number>();
    for (const { term, doc, col, tf } of postings) {
      const row = perDoc.get(doc) ?? new Map<string, Cols>();
      const cols = row.get(term) ?? { title: 0, path: 0, body: 0 };
      if (!row.has(term)) df.set(term, (df.get(term) ?? 0) + 1);
      cols[COL[col]] = tf;
      row.set(term, cols);
      perDoc.set(doc, row);
    }
    const metas = readMeta(db, p, JSON.stringify([...perDoc.keys()]));
    lap("meta");
    const inbound = new Map(readInbound(db, p, JSON.stringify(metas.map((m) => m.id))).map((r) => [r.dst, r.c]));
    lap("links");
    const avg = { title: stats.lt / stats.n, path: stats.lp / stats.n, body: stats.lb / stats.n };
    const hits = metas.map((m): Hit => {
      const found: TermStat[] = [...(perDoc.get(m.n) ?? [])].map(([term, tf]) => ({ idf: idf(stats.n, df.get(term) ?? 0), tf }));
      const text = textScore(found, { title: m.lt, path: m.lp, body: m.lb }, avg, c.weights);
      const rec = recency(c.now, m.mtime);
      const links = linkSignal(inbound.get(m.id) ?? 0);
      return { id: m.id, path: m.path, score: combine(text, rec, links), signals: { text, recency: rec, links } };
    });
    const top = hits.sort(byScore).slice(0, c.k);
    lap("score");
    return top;
  });
};
