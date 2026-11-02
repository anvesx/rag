import { DatabaseSync } from "node:sqlite";

/** Raw handle that bypasses the chain; drops the triggers so tests can tamper. */
export function rawTamperDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 30000");
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as { name: string }[];
  for (const { name } of names) db.exec(`DROP TRIGGER ${name}`);
  return db;
}
