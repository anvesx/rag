import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowClause, isAllowed } from "../../src/index.js";

describe("integration: filtering a real table", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "acl-filter-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns exactly the rows isAllowed accepts", () => {
    const db = new DatabaseSync(join(dir, "acl.db"));
    db.exec("CREATE TABLE docs (id INTEGER, tenant_id TEXT, allow_users TEXT, allow_groups TEXT)");
    const rows = [
      [1, "t1", ["alice"], []],
      [2, "t1", [], ["eng"]],
      [3, "t1", [], []],
      [4, "t2", ["alice"], ["eng"]],
      [5, "t1", ["bob"], ["ops"]],
    ] as const;
    const ins = db.prepare("INSERT INTO docs VALUES (?, ?, ?, ?)");
    for (const [i, t, u, g] of rows) ins.run(i, t, JSON.stringify(u), JSON.stringify(g));
    const p = { id: "alice", tenantId: "t1", groups: ["eng"] };
    const { sql, params } = allowClause(p);
    const got = db
      .prepare(`SELECT id FROM docs WHERE ${sql} ORDER BY id`)
      .all(...(params as never[]))
      .map((r) => Number(r["id"]));
    const want = rows.filter(([, t, u, g]) => isAllowed(p, { allowUsers: [...u], allowGroups: [...g], version: 1 }, t)).map(([i]) => i);
    expect(got).toEqual([1, 2]);
    expect(got).toEqual(want);
  });

  it("denies rows whose ACL columns are NULL", () => {
    const db = new DatabaseSync(join(dir, "acl.db"));
    db.exec("CREATE TABLE docs (tenant_id TEXT, allow_users TEXT, allow_groups TEXT)");
    db.exec("INSERT INTO docs VALUES ('t1', NULL, NULL)");
    const { sql, params } = allowClause({ id: "a", tenantId: "t1", groups: ["g"] });
    expect(db.prepare(`SELECT 1 FROM docs WHERE ${sql}`).all(...(params as never[]))).toEqual([]);
  });
});
