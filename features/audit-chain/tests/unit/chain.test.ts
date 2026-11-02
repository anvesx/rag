import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GENESIS, hashEvent } from "../../src/canonical.js";
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

describe("append", () => {
  it("starts at seq 1 with prev = 64 zeros and chains hashes", () => {
    const c = fresh();
    const a = c.append(ev());
    const b = c.append(ev({ action: "write" }));
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(a.hash).toBe(hashEvent(GENESIS, ev()));
    expect(b.hash).toBe(hashEvent(a.hash, ev({ action: "write" })));
  });
  it("keeps one independent chain per tenant", () => {
    const c = fresh();
    c.append(ev());
    const other = c.append(ev({ tenantId: "t2" }));
    expect(other.seq).toBe(1);
    expect(other.hash).toBe(hashEvent(GENESIS, ev({ tenantId: "t2" })));
    expect(c.list("t1")).toHaveLength(1);
  });
  it("accepts identical duplicate events as separate entries", () => {
    const c = fresh();
    const a = c.append(ev());
    const b = c.append(ev());
    expect(b.seq).toBe(2);
    expect(b.hash).not.toBe(a.hash);
  });
  it("throws INVALID for bad input and stores nothing", () => {
    const c = fresh();
    expect(code(() => c.append(ev({ actor: "" })))).toBe("INVALID");
    expect(code(() => c.append(null as never))).toBe("INVALID");
    expect(c.list("t1")).toEqual([]);
  });
  it("stores unicode and nested detail and returns it intact", () => {
    const c = fresh();
    const detail = { note: "héllo 😀 \u0000", deep: { list: [1, null, { z: true }], n: -0.5 } };
    c.append(ev({ detail }));
    expect(c.list("t1")[0]?.detail).toEqual(detail);
    expect(c.verify("t1")).toEqual({ ok: true });
  });
});

describe("verify", () => {
  it("is ok on an empty or unknown tenant", () => expect(fresh().verify("nobody")).toEqual({ ok: true }));
  it("is ok after many appends", () => {
    const c = fresh();
    for (let i = 0; i < 20; i++) c.append(ev({ target: `d${i}`, ...(i % 2 ? { detail: { i } } : {}) }));
    expect(c.verify("t1")).toEqual({ ok: true });
  });
  it("throws INVALID for a bad tenantId", () => {
    expect(code(() => fresh().verify(""))).toBe("INVALID");
    expect(code(() => fresh().verify(1 as never))).toBe("INVALID");
  });
});
