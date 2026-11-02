import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createAuditChain } from "@rag/audit-chain";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAuditService, createFileAnchorStore } from "../../src/index.js";

const dir = mkdtempSync(join(tmpdir(), "audit-svc-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
let db = "";
let anchors = "";
const clock = () => new Date("2026-02-03T04:05:06.000Z");
const open = () => createAuditService({ chain: createAuditChain(db), anchorStore: createFileAnchorStore(anchors), clock });
const ev = (i: number) => ({ actor: "a", action: "x", target: `d${i}`, detail: { i } });
const raw = (sql: string) => {
  const h = new DatabaseSync(db);
  h.exec("DROP TRIGGER audit_no_update");
  h.exec("DROP TRIGGER audit_no_delete");
  h.exec(sql);
  h.close();
};
const three = async () => {
  const s = open();
  for (let i = 1; i <= 3; i++) await s.record("t", ev(i));
  return s;
};

beforeEach(() => {
  db = join(dir, `${n}.db`);
  anchors = join(dir, `${n++}.anchors`);
});

describe("durable audit with file anchors", () => {
  it("record, checkpoint, reopen, verify ok", async () => {
    await (await three()).checkpoint("t");
    expect(await open().verify("t")).toEqual({ status: "ok" });
    expect(readFileSync(anchors, "utf8").trim().split("\n")).toHaveLength(1);
  });
  it("detects an edited row", async () => {
    await three();
    raw("UPDATE audit SET actor = 'evil' WHERE seq = 2");
    expect(await open().verify("t")).toEqual({ status: "mismatch", brokenAt: 2 });
  });
  it("detects tail truncation after checkpoint", async () => {
    await (await three()).checkpoint("t");
    raw("DELETE FROM audit WHERE seq = 3");
    expect(await open().verify("t")).toEqual({ status: "truncated", brokenAt: 3 });
  });
  it("is blind to the same truncation without a checkpoint", async () => {
    await three();
    raw("DELETE FROM audit WHERE seq = 3");
    expect(await open().verify("t")).toEqual({ status: "ok" });
  });
  it("uses the latest anchor of each tenant", async () => {
    const s = open();
    await s.record("a", ev(1));
    await s.checkpoint("a");
    await s.record("b", ev(1));
    await s.record("a", ev(2));
    await s.checkpoint("a");
    raw("DELETE FROM audit WHERE tenant_id = 'a' AND seq = 2");
    const r = open();
    expect(await r.verify("a")).toEqual({ status: "truncated", brokenAt: 2 });
    expect(await r.verify("b")).toEqual({ status: "ok" });
  });
});
