import { DatabaseSync } from "node:sqlite";
import { RankError } from "../model/errors.js";

/**
 * docs: pointer plus per-column token counts. No title or body.
 * postings: one row per (keyed term, doc, column) with its term frequency. No positions, so word order is not stored.
 * acl and links are plain tables; acl is keyed principal-first so the ACL pre-filter is an index range scan.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS docs(n INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, path TEXT NOT NULL, mtime REAL NOT NULL,
  lt INTEGER NOT NULL, lp INTEGER NOT NULL, lb INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS acl(principal TEXT NOT NULL, doc INTEGER NOT NULL, PRIMARY KEY(principal, doc)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS acl_doc ON acl(doc);
CREATE TABLE IF NOT EXISTS links(dst TEXT NOT NULL, src INTEGER NOT NULL, PRIMARY KEY(dst, src)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS links_src ON links(src);
CREATE TABLE IF NOT EXISTS postings(term TEXT NOT NULL, doc INTEGER NOT NULL, col TEXT NOT NULL, tf INTEGER NOT NULL,
  PRIMARY KEY(term, doc, col)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS postings_doc ON postings(doc);
`;

/** Documents the asker may read. Bound as :p, a JSON array of principals. Every read statement embeds this. */
export const VISIBLE = "SELECT doc FROM acl WHERE principal IN (SELECT value FROM json_each(:p))";

export const openDb = (file: string): DatabaseSync => {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  if (db.prepare("SELECT 1 AS x FROM sqlite_master WHERE name = 'fts'").get()) {
    db.close();
    throw new RankError("BAD_INDEX", "this file uses the old FTS5 format, which exposes word positions; build a new index file");
  }
  db.exec(DDL);
  return db;
};
