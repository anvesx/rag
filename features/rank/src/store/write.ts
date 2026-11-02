import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { Doc } from "../model/types.js";
import type { Keyer } from "../text/keyed.js";
import { tokenize } from "../text/tokenize.js";
import { writeTx } from "./tx.js";

const run = (db: DatabaseSync, sql: string, ...params: SQLInputValue[]): void => {
  db.prepare(sql).run(...params);
};

const clear = (db: DatabaseSync, n: number): void => {
  run(db, "DELETE FROM postings WHERE doc = ?", n);
  run(db, "DELETE FROM acl WHERE doc = ?", n);
  run(db, "DELETE FROM links WHERE src = ?", n);
};

/** Term frequency per keyed term for one column. Only counts are stored, never the order of the words. */
const post = (db: DatabaseSync, n: number, col: string, tokens: readonly string[], term: Keyer): void => {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const ins = db.prepare("INSERT INTO postings(term, doc, col, tf) VALUES(?, ?, ?, ?) ON CONFLICT(term, doc, col) DO UPDATE SET tf = tf + excluded.tf");
  for (const [t, c] of tf) ins.run(term(t), n, col, c);
};

const put = (db: DatabaseSync, d: Doc, term: Keyer): void => {
  const [t, p, b] = [tokenize(d.title), tokenize(d.path), tokenize(d.body)];
  const row = db
    .prepare(
      `INSERT INTO docs(id, path, mtime, lt, lp, lb) VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET path = excluded.path, mtime = excluded.mtime, lt = excluded.lt, lp = excluded.lp, lb = excluded.lb
       RETURNING n`,
    )
    .get(d.id, d.path, d.mtimeMs, t.length, p.length, b.length) as { n: number };
  clear(db, row.n);
  post(db, row.n, "t", t, term);
  post(db, row.n, "p", p, term);
  post(db, row.n, "b", b, term);
  for (const principal of d.principals) run(db, "INSERT OR IGNORE INTO acl(principal, doc) VALUES(?, ?)", principal, row.n);
  for (const dst of d.links) if (dst !== d.id) run(db, "INSERT OR IGNORE INTO links(dst, src) VALUES(?, ?)", dst, row.n);
};

/** Upsert by id in one transaction. The last duplicate in the batch wins. Returns distinct ids written. */
export const upsertDocs = (db: DatabaseSync, docs: readonly Doc[], term: Keyer): number => {
  const latest = [...new Map(docs.map((d) => [d.id, d])).values()];
  writeTx(db, () => {
    for (const d of latest) put(db, d, term);
  });
  return latest.length;
};

export const removeDocs = (db: DatabaseSync, ids: readonly string[]): number =>
  writeTx(db, () => {
    let removed = 0;
    for (const id of new Set(ids)) {
      const row = db.prepare("SELECT n FROM docs WHERE id = ?").get(id) as { n: number } | undefined;
      if (!row) continue;
      clear(db, row.n);
      run(db, "DELETE FROM docs WHERE n = ?", row.n);
      removed++;
    }
    return removed;
  });
