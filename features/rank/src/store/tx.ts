import type { DatabaseSync } from "node:sqlite";

/** Undo after a failure. A failing ROLLBACK must not hide the error that got us here. */
const abandon = (db: DatabaseSync): void => {
  try {
    db.exec("ROLLBACK");
  } catch {
    // No transaction is open any more. The caller rethrows the original error.
  }
};

/** One read snapshot (WAL): every statement of a search sees the same committed state. */
export const readTx = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec("BEGIN");
  let out: T;
  try {
    out = fn();
  } catch (error) {
    abandon(db);
    throw error;
  }
  db.exec("COMMIT");
  return out;
};

/** All or nothing. A concurrent reader sees the whole write or none of it. */
export const writeTx = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    abandon(db);
    throw error;
  }
};
