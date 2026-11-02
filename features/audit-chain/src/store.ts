import { DatabaseSync } from "node:sqlite";
import { GENESIS } from "./canonical.js";
import { AuditError } from "./errors.js";
import { installTriggers } from "./triggers.js";

export type Row = {
  seq: number;
  actor: string;
  action: string;
  target: string;
  at: string;
  detail: string | null;
  hash: string;
};

const COLS = "seq, actor, action, target, at, detail, hash";

export interface Store {
  append(
    tenant: string,
    detail: string | null,
    e: { actor: string; action: string; target: string; at: string },
    hashOf: (prev: string) => string,
  ): { seq: number; hash: string };
  rows(tenant: string, after: number, limit: number): Row[];
  each(tenant: string): IterableIterator<Row>;
  head(tenant: string): { seq: number; hash: string };
  close(): void;
}

export function openStore(path: string): Store {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path);
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA journal_mode = WAL;");
    db.exec(`CREATE TABLE IF NOT EXISTS audit (
      tenant_id TEXT NOT NULL, seq INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
      target TEXT NOT NULL, at TEXT NOT NULL, detail TEXT, hash TEXT NOT NULL,
      PRIMARY KEY (tenant_id, seq)) WITHOUT ROWID`);
    installTriggers(db);
  } catch (cause) {
    throw new AuditError("STORAGE", `cannot open ${path}`, { cause });
  }
  const last = db.prepare("SELECT seq, hash FROM audit WHERE tenant_id = ? ORDER BY seq DESC LIMIT 1");
  const insert = db.prepare("INSERT INTO audit (tenant_id, seq, actor, action, target, at, detail, hash) VALUES (?,?,?,?,?,?,?,?)");
  const page = db.prepare(`SELECT ${COLS} FROM audit WHERE tenant_id = ? AND seq > ? ORDER BY seq LIMIT ?`);
  const all = db.prepare(`SELECT ${COLS} FROM audit WHERE tenant_id = ? ORDER BY seq`);

  return {
    append(tenant, detail, e, hashOf) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const p = last.get(tenant) as { seq: number; hash: string } | undefined;
        const seq = (p?.seq ?? 0) + 1;
        const hash = hashOf(p?.hash ?? GENESIS);
        insert.run(tenant, seq, e.actor, e.action, e.target, e.at, detail, hash);
        db.exec("COMMIT");
        return { seq, hash };
      } catch (cause) {
        db.exec("ROLLBACK");
        throw new AuditError("STORAGE", "append failed", { cause });
      }
    },
    rows: (tenant, after, limit) => page.all(tenant, after, limit) as Row[],
    each: (tenant) => all.iterate(tenant) as IterableIterator<Row>,
    head: (tenant) => (last.get(tenant) as { seq: number; hash: string } | undefined) ?? { seq: 0, hash: GENESIS },
    close: () => db.close(),
  };
}
