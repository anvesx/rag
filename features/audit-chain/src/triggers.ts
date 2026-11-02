import type { DatabaseSync } from "node:sqlite";

export const NO_UPDATE = "audit_no_update";
export const NO_DELETE = "audit_no_delete";

/** Makes the table append-only: any UPDATE or DELETE aborts. */
export function installTriggers(db: DatabaseSync): void {
  for (const [name, op] of [
    [NO_UPDATE, "UPDATE"],
    [NO_DELETE, "DELETE"],
  ] as const) {
    db.exec(
      `CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${op} ON audit
       BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END`,
    );
  }
}
