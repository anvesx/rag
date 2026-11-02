import type { DatabaseSync } from "node:sqlite";
import { VISIBLE } from "./schema.js";

export type Stats = { n: number; lt: number; lp: number; lb: number };
export type Posting = { term: string; doc: number; col: "t" | "p" | "b"; tf: number };
export type Meta = { n: number; id: string; path: string; mtime: number; lt: number; lp: number; lb: number };

/** Corpus statistics over the visible set only. A hidden doc cannot move N, df or average length. */
export const readStats = (db: DatabaseSync, p: string): Stats =>
  db
    .prepare(`SELECT count(*) AS n, coalesce(sum(lt), 0) AS lt, coalesce(sum(lp), 0) AS lp, coalesce(sum(lb), 0) AS lb FROM docs WHERE n IN (${VISIBLE})`)
    .get({ p }) as Stats;

/** Term frequency per (term, doc, column), restricted to visible docs inside the query. */
export const readPostings = (db: DatabaseSync, p: string, terms: string): Posting[] =>
  db
    .prepare(`SELECT term, doc, col, tf FROM postings WHERE term IN (SELECT value FROM json_each(:terms)) AND doc IN (${VISIBLE})`)
    .all({ p, terms }) as Posting[];

export const readMeta = (db: DatabaseSync, p: string, docs: string): Meta[] =>
  db
    .prepare(`SELECT n, id, path, mtime, lt, lp, lb FROM docs WHERE n IN (SELECT value FROM json_each(:docs)) AND n IN (${VISIBLE})`)
    .all({ p, docs }) as Meta[];

/** Inbound link counts per target id, counting only source docs the asker may read. */
export const readInbound = (db: DatabaseSync, p: string, ids: string): { dst: string; c: number }[] =>
  db.prepare(`SELECT dst, count(*) AS c FROM links WHERE dst IN (SELECT value FROM json_each(:ids)) AND +src IN (${VISIBLE}) GROUP BY dst`).all({ p, ids }) as {
    dst: string;
    c: number;
  }[];
