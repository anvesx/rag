import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AuditError, type AuditEvent, createAuditChain } from "../../src/chain.js";

const dir = mkdtempSync(join(tmpdir(), "audit-unit-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const fresh = () => createAuditChain(join(dir, `${n++}.db`));
const ev = (o: Partial<AuditEvent> = {}): AuditEvent => ({
  tenantId: "t1",
  actor: "alice",
  action: "read",
  target: "doc/1",
  at: "2026-01-01T00:00:00Z",
  ...o,
});
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e instanceof AuditError ? e.code : "OTHER";
  }
  return "NONE";
};

describe("list", () => {
  const seeded = () => {
    const c = fresh();
    for (let i = 0; i < 5; i++) c.append(ev({ target: `d${i}` }));
    return c;
  };
  it("returns entries in seq order with hash", () => {
    const l = seeded().list("t1");
    expect(l.map((x) => x.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(l[0]).toMatchObject({ ...ev({ target: "d0" }), seq: 1 });
    expect(l[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(l[0]).not.toHaveProperty("detail");
  });
  it("pages with afterSeq and limit", () => {
    const c = seeded();
    expect(c.list("t1", 2, 2).map((x) => x.seq)).toEqual([3, 4]);
    expect(c.list("t1", 4).map((x) => x.seq)).toEqual([5]);
    expect(c.list("t1", 5)).toEqual([]);
    expect(c.list("t1", 0, 1)).toHaveLength(1);
  });
  it("rejects bad paging arguments", () => {
    const c = seeded();
    for (const [a, l] of [
      [-1, 1],
      [1.5, 1],
      [0, 0],
      [0, 1001],
      [0, Number.NaN],
    ] as const)
      expect(code(() => c.list("t1", a, l))).toBe("INVALID");
    expect(code(() => c.list("", 0, 1))).toBe("INVALID");
    expect(code(() => c.list("t1", 0, 1000))).toBe("NONE");
  });
});

describe("open", () => {
  it("throws STORAGE when the path cannot be opened", () => expect(code(() => createAuditChain(join(dir, "no/such/dir/x.db")))).toBe("STORAGE"));
});
