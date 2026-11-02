import { describe, expect, it } from "vitest";
import { allowClause } from "../../src/index.js";
import { acl, sqlAllows } from "../helpers.js";

describe("allowClause", () => {
  it("never puts ids into the SQL text", () => {
    const nasty = "x'); DROP TABLE t;-- %_ ü😀";
    const a = allowClause({ id: nasty, tenantId: nasty, groups: [nasty] });
    const b = allowClause({ id: "a", tenantId: "b", groups: [] });
    expect(a.sql).toBe(b.sql);
    expect(a.sql).not.toContain("DROP");
    expect(a.params).toContain(nasty);
  });

  it("binds tenant, user id and a JSON group list in order", () => {
    expect(allowClause({ id: "u", tenantId: "t", groups: ["g1", "g2"] }).params).toEqual(["t", "u", '["g1","g2"]']);
  });

  it("matches ids containing quotes, percent and unicode literally", () => {
    const id = "o'brien%_\"ü😀";
    const row = { tenant: "t1", acl: acl([id], []) };
    expect(sqlAllows({ id, tenantId: "t1", groups: [] }, row)).toBe(true);
    expect(sqlAllows({ id: "o'brien", tenantId: "t1", groups: [] }, row)).toBe(false);
    expect(sqlAllows({ id: "%", tenantId: "t1", groups: [] }, row)).toBe(false);
  });

  it("works with 1000 groups", () => {
    const groups = Array.from({ length: 1000 }, (_, i) => `g${i}`);
    const row = { tenant: "t1", acl: acl([], ["g500"]) };
    expect(sqlAllows({ id: "x", tenantId: "t1", groups }, row)).toBe(true);
  });

  it("denies on tenant mismatch and on empty lists", () => {
    const p = { id: "u", tenantId: "t1", groups: ["g"] };
    expect(sqlAllows(p, { tenant: "t2", acl: acl(["u"], ["g"]) })).toBe(false);
    expect(sqlAllows(p, { tenant: "t1", acl: acl([], []) })).toBe(false);
  });

  it("allows a listed user when the group list is empty", () => {
    const p = { id: "u", tenantId: "t1", groups: [] };
    expect(sqlAllows(p, { tenant: "t1", acl: acl(["u"], []) })).toBe(true);
  });
});
