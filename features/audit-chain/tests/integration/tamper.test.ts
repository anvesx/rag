import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

describe("triggers", () => {
  it("block SQL UPDATE", () => {
    const db = new DatabaseSync(path);
    expect(() => db.exec("UPDATE audit SET actor = 'evil' WHERE seq = 2")).toThrow(/append-only/);
    db.close();
    expect(createAuditChain(path).verify("t")).toEqual({ ok: true });
  });
  it("block SQL DELETE", () => {
    const db = new DatabaseSync(path);
    expect(() => db.exec("DELETE FROM audit WHERE seq = 2")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM audit")).toThrow(/append-only/);
    db.close();
    expect(createAuditChain(path).list("t")).toHaveLength(5);
  });
  it("are reinstalled when the file is reopened", () => {
    rawTamperDb(path).close();
    createAuditChain(path);
    const db = new DatabaseSync(path);
    expect(() => db.exec("DELETE FROM audit")).toThrow(/append-only/);
    db.close();
  });
});

describe("reopen", () => {
  it("keeps the chain and continues it", () => {
    const c = createAuditChain(path);
    expect(c.verify("t")).toEqual({ ok: true });
    expect(c.append({ ...base }).seq).toBe(6);
    expect(createAuditChain(path).verify("t")).toEqual({ ok: true });
  });
});
