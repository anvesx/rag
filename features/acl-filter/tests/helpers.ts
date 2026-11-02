import { DatabaseSync } from "node:sqlite";
import type { Acl, Principal } from "@anvesx/core-types";
import { allowClause } from "../src/index.js";

export interface Row {
  tenant: string;
  acl: Acl;
}

export function sqlAllows(p: Principal, row: Row): boolean {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE t (tenant_id TEXT, allow_users TEXT, allow_groups TEXT)");
    db.prepare("INSERT INTO t VALUES (?, ?, ?)").run(row.tenant, JSON.stringify(row.acl.allowUsers), JSON.stringify(row.acl.allowGroups));
    const { sql, params } = allowClause(p);
    const hit = db.prepare(`SELECT COUNT(*) AS n FROM t WHERE ${sql}`).get(...(params as never[]));
    return Number(hit?.["n"]) === 1;
  } finally {
    db.close();
  }
}

export const acl = (allowUsers: string[], allowGroups: string[]): Acl => ({
  allowUsers,
  allowGroups,
  version: 1,
});
