import type { Cols } from "../model/types.js";

export const DAY_MS = 86_400_000;
export const WEIGHTS: Cols = { title: 3, path: 2, body: 1 };
const K1 = 1.2;
const B = 0.75;
const HALF_LIFE_MS = 90 * DAY_MS;
const COLS = ["title", "path", "body"] as const;

export type TermStat = { idf: number; tf: Cols };

/** Robertson IDF over the visible set: N and df count only documents the asker may read. */
export const idf = (n: number, df: number): number => Math.log(1 + (n - df + 0.5) / (df + 0.5));

/** BM25F: weighted, length-normalized tf per column summed first, then saturated once per term. */
export const textScore = (terms: readonly TermStat[], len: Cols, avg: Cols, w: Cols): number =>
  terms.reduce((sum, { idf: weight, tf }) => {
    const pooled = COLS.reduce((s, c) => (avg[c] === 0 ? s : s + (w[c] * tf[c]) / (1 - B + (B * len[c]) / avg[c])), 0);
    return sum + (weight * pooled) / (K1 + pooled);
  }, 0);

export const recency = (now: number, mtimeMs: number): number => 0.5 ** (Math.max(0, now - mtimeMs) / HALF_LIFE_MS);

export const linkSignal = (inbound: number): number => Math.log(1 + inbound);

/** Priors scale a text match. They cannot create one: text 0 stays 0. */
export const combine = (text: number, rec: number, links: number): number => text * (1 + 0.2 * rec + 0.1 * links);
