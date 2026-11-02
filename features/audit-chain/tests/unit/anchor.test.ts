import { describe, expect, it } from "vitest";
import { GENESIS } from "../../src/canonical.js";
import { AuditError, createAuditChain } from "../../src/chain.js";

const ev = (i: number) => ({ tenantId: "t", actor: "a", action: "x", target: `d${i}`, at: "2026-01-01T00:00:00Z" });
const seeded = (count: number) => {
  const c = createAuditChain(":memory:");
  for (let i = 1; i <= count; i++) c.append(ev(i));
  return c;
};

describe("head", () => {
  it("is genesis for an empty tenant", () => {
    expect(createAuditChain(":memory:").head("t")).toEqual({ seq: 0, hash: GENESIS });
  });
  it("matches the last append", () => {
    const c = seeded(3);
    const last = c.append(ev(4));
    expect(c.head("t")).toEqual(last);
  });
  it("is per tenant", () => {
    const c = seeded(2);
    expect(c.head("other")).toEqual({ seq: 0, hash: GENESIS });
  });
  it("rejects an empty tenant id", () => {
    expect(() => seeded(1).head("")).toThrow(AuditError);
  });
});

describe("verify with an anchor", () => {
  it("accepts the current head, an older head and genesis", () => {
    const c = seeded(3);
    const old = c.head("t");
    c.append(ev(4));
    expect(c.verify("t", c.head("t"))).toEqual({ ok: true });
    expect(c.verify("t", old)).toEqual({ ok: true });
    expect(c.verify("t", { seq: 0, hash: GENESIS })).toEqual({ ok: true });
  });
  it("flags a wrong hash at a present seq as mismatch", () => {
    const c = seeded(3);
    expect(c.verify("t", { seq: 2, hash: "ab" })).toEqual({ ok: false, brokenAt: 2, anchor: "mismatch" });
  });
  it("flags a seq beyond the chain as truncated", () => {
    const c = seeded(3);
    expect(c.verify("t", { seq: 9, hash: "ab" })).toEqual({ ok: false, brokenAt: 4, anchor: "truncated" });
  });
  it.each([{ seq: -1, hash: GENESIS }, { seq: 1.5, hash: GENESIS }, { seq: 1, hash: "" }, { seq: 1 } as never])("rejects malformed anchor %j", (a) => {
    expect(() => seeded(1).verify("t", a)).toThrow(AuditError);
  });
});
