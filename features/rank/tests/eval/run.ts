import { readFileSync } from "node:fs";
import { type Cols, RankIndex } from "../../src/index.js";
import { NOW } from "../support/oracle.js";
import { corpus } from "./data/corpus.js";
import { mean, mrr, ndcgAt, recallAt } from "./metrics.js";

const KEY = "rank-eval-key-0123456789abcdef";

export type Golden = { query: string; principals: string[]; relevant: string[] };
export type Scores = { ndcg10: number; recall20: number; mrr: number };

export const golden = (): Golden[] => JSON.parse(readFileSync(new URL("./data/golden.json", import.meta.url), "utf8")) as Golden[];

/** Index the generated corpus, run every golden query, and average the three metrics. */
export const evaluate = (weights?: Cols): Scores => {
  const ix = RankIndex.open(":memory:", { key: KEY, now: () => NOW, ...(weights ? { weights } : {}) });
  ix.index(corpus());
  const rows = golden().map((g) => {
    const ranked = ix.search({ query: g.query, asker: { principals: g.principals }, k: 100 }).map((h) => h.id);
    const rel = new Set(g.relevant);
    return { ndcg10: ndcgAt(ranked, rel, 10), recall20: recallAt(ranked, rel, 20), mrr: mrr(ranked, rel) };
  });
  ix.close();
  return { ndcg10: mean(rows.map((r) => r.ndcg10)), recall20: mean(rows.map((r) => r.recall20)), mrr: mean(rows.map((r) => r.mrr)) };
};
