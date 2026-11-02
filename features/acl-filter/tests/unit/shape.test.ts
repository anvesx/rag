import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { allowClause } from "../../src/index.js";

const hits = (ddl: string, tenant: string, users: string, groups: string, p: { id: string; tenantId: string; groups: string[] }): number => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE t (${ddl})`);
    db.prepare("INSERT INTO t VALUES (?, ?, ?)").run(tenant, users, groups);
    const { sql, params } = allowClause(p);
    return Number(db.prepare(`SELECT COUNT(*) AS n FROM t WHERE ${sql}`).get(...(params as never[]))?.["n"]);
  } finally {
    db.close();
  }
};
const plain = "tenant_id TEXT, allow_users TEXT, allow_groups TEXT";
const alice = { id: "alice", tenantId: "t1", groups: [] };

describe("ACL column shape and collation", () => {
  it("a non-array ACL column never grants access", () => {
    expect(hits(plain, "t1", '{"k":"alice"}', "[]", alice)).toBe(0);
    expect(hits(plain, "t1", '"alice"', "[]", alice)).toBe(0);
    expect(hits(plain, "t1", "[]", '{"k":"eng"}', { ...alice, groups: ["eng"] })).toBe(0);
  });
  it("matches ids exactly even on NOCASE columns", () => {
    const nocase = "tenant_id TEXT COLLATE NOCASE, allow_users TEXT, allow_groups TEXT";
    expect(hits(nocase, "acme", '["alice"]', "[]", { ...alice, tenantId: "ACME" })).toBe(0);
    expect(hits(nocase, "acme", '["Alice"]', "[]", { ...alice, tenantId: "acme" })).toBe(0);
  });
});
