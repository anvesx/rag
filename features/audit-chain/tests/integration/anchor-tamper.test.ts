import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GENESIS, hashEvent } from "../../src/canonical.js";
import { createAuditChain } from "../../src/chain.js";
import { rawTamperDb } from "../helpers.js";

const dir = mkdtempSync(join(tmpdir(), "audit-anchor-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const ev = (i: number, action = "x") => ({ tenantId: "t", actor: "a", action, target: `d${i}`, at: "2026-01-01T00:00:00Z" });
const seeded = (count: number) => {
  const path = join(dir, `${n++}.db`);
  const c = createAuditChain(path);
  for (let i = 1; i <= count; i++) c.append(ev(i));
  return { path, anchor: c.head("t") };
};
/** Rewrites row 1 as a "read" and recomputes every hash up to `count`, like a careful attacker. */
const rewrite = (path: string, count: number) => {
  const db = rawTamperDb(path);
  let prev = GENESIS;
  for (let i = 1; i <= count; i++) {
    prev = hashEvent(prev, ev(i, i === 1 ? "read" : "x"));
    db.prepare("UPDATE audit SET action = ?, hash = ? WHERE seq = ?").run(i === 1 ? "read" : "x", prev, i);
  }
  db.close();
};
const sql = (path: string, q: string) => {
  const db = rawTamperDb(path);
  db.exec(q);
  db.close();
};

describe("anchored verify catches what a bare chain cannot", () => {
  it("tail truncation", () => {
    const { path, anchor } = seeded(5);
    sql(path, "DELETE FROM audit WHERE seq >= 3");
    expect(createAuditChain(path).verify("t")).toEqual({ ok: true }); // inherent without an anchor
    expect(createAuditChain(path).verify("t", anchor)).toEqual({ ok: false, brokenAt: 3, anchor: "truncated" });
  });
  it("whole chain deleted", () => {
    const { path, anchor } = seeded(2);
    sql(path, "DELETE FROM audit");
    expect(createAuditChain(path).verify("t", anchor)).toEqual({ ok: false, brokenAt: 1, anchor: "truncated" });
  });
  it("full rewrite with recomputed hashes", () => {
    const { path, anchor } = seeded(2);
    rewrite(path, 2);
    expect(createAuditChain(path).verify("t")).toEqual({ ok: true });
    expect(createAuditChain(path).verify("t", anchor)).toEqual({ ok: false, brokenAt: 2, anchor: "mismatch" });
  });
  it("rewrite of old history followed by new appends", () => {
    const { path, anchor } = seeded(3);
    rewrite(path, 3);
    const c = createAuditChain(path);
    c.append(ev(4));
    expect(c.verify("t")).toEqual({ ok: true });
    expect(c.verify("t", anchor)).toEqual({ ok: false, brokenAt: 3, anchor: "mismatch" });
  });
  it("an internally broken chain reports plain brokenAt", () => {
    const { path, anchor } = seeded(5);
    sql(path, "UPDATE audit SET actor = 'evil' WHERE seq = 2");
    expect(createAuditChain(path).verify("t", anchor)).toEqual({ ok: false, brokenAt: 2 });
  });
  it("head survives reopen", () => {
    const { path, anchor } = seeded(3);
    expect(createAuditChain(path).head("t")).toEqual(anchor);
  });
});
