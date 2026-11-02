import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAuditChain } from "../../src/chain.js";
import { rawTamperDb } from "../helpers.js";

const dir = mkdtempSync(join(tmpdir(), "audit-int-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let path = "";
let n = 0;
const base = { tenantId: "t", actor: "a", action: "x", target: "d", at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  path = join(dir, `${n++}.db`);
  const c = createAuditChain(path);
  for (let i = 1; i <= 5; i++) c.append({ ...base, target: `d${i}`, detail: { i } });
});

describe("raw-SQL tamper is detected at the first bad seq", () => {
  const run = (sql: string) => {
    const db = rawTamperDb(path);
    db.exec(sql);
    db.close();
  };
  const verify = () => createAuditChain(path).verify("t");

  it("edited field", () => {
    run("UPDATE audit SET actor = 'evil' WHERE seq = 3");
    expect(verify()).toEqual({ ok: false, brokenAt: 3 });
  });
  it("edited detail", () => {
    run(`UPDATE audit SET detail = '{"i":99}' WHERE seq = 2`);
    expect(verify()).toEqual({ ok: false, brokenAt: 2 });
  });
  it("detail made invalid JSON", () => {
    run("UPDATE audit SET detail = '{oops' WHERE seq = 4");
    expect(verify()).toEqual({ ok: false, brokenAt: 4 });
  });
  it("detail removed", () => {
    run("UPDATE audit SET detail = NULL WHERE seq = 1");
    expect(verify()).toEqual({ ok: false, brokenAt: 1 });
  });
  it("edited stored hash", () => {
    run(`UPDATE audit SET hash = '${"f".repeat(64)}' WHERE seq = 5`);
    expect(verify()).toEqual({ ok: false, brokenAt: 5 });
  });
  it("deleted middle row", () => {
    run("DELETE FROM audit WHERE seq = 3");
    expect(verify()).toEqual({ ok: false, brokenAt: 3 });
  });
  it("deleted first row", () => {
    run("DELETE FROM audit WHERE seq = 1");
    expect(verify()).toEqual({ ok: false, brokenAt: 1 });
  });
  it("reordered rows", () => {
    run("UPDATE audit SET seq = 99 WHERE seq = 2; UPDATE audit SET seq = 2 WHERE seq = 3; UPDATE audit SET seq = 3 WHERE seq = 99;");
    expect(verify()).toEqual({ ok: false, brokenAt: 2 });
  });
  it("edit in one tenant leaves other tenants verifiable", () => {
    const c = createAuditChain(path);
    c.append({ ...base, tenantId: "other" });
    run("UPDATE audit SET actor = 'evil' WHERE tenant_id = 't' AND seq = 1");
    expect(c.verify("t")).toEqual({ ok: false, brokenAt: 1 });
    expect(c.verify("other")).toEqual({ ok: true });
  });
});
