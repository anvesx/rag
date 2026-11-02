import { describe, expect, it } from "vitest";
import { GENESIS, hashEvent, MAX_DETAIL, MAX_FIELD, validateEvent } from "../../src/canonical.js";
import { AuditError } from "../../src/errors.js";

const ev = { tenantId: "t", actor: "a", action: "x", target: "doc", at: "2026-01-01T00:00:00Z" };
const invalid = (e: unknown) => {
  try { validateEvent(e); } catch (err) { return err instanceof AuditError && err.code === "INVALID"; }
  return false;
};

describe("validateEvent", () => {
  it("accepts a good event and returns null detail", () => expect(validateEvent(ev)).toBeNull());
  it("returns canonical detail with sorted keys", () =>
    expect(validateEvent({ ...ev, detail: { b: 1, a: { d: 1, c: [1] } } })).toBe('{"a":{"c":[1],"d":1},"b":1}'));
  it("rejects non-objects", () => {
    for (const v of [null, undefined, 1, "s", [], true]) expect(invalid(v)).toBe(true);
  });
  it("rejects missing, empty and wrong-typed fields", () => {
    for (const k of ["tenantId", "actor", "action", "target", "at"]) {
      expect(invalid({ ...ev, [k]: "" })).toBe(true);
      expect(invalid({ ...ev, [k]: 5 })).toBe(true);
      expect(invalid({ ...ev, [k]: null })).toBe(true);
      const { [k]: _gone, ...rest } = ev as Record<string, string>;
      expect(invalid(rest)).toBe(true);
    }
  });
  it("rejects fields over the length cap but accepts the cap exactly", () => {
    expect(invalid({ ...ev, actor: "a".repeat(MAX_FIELD + 1) })).toBe(true);
    expect(invalid({ ...ev, actor: "a".repeat(MAX_FIELD) })).toBe(false);
  });
  it("rejects non-ISO and impossible dates", () => {
    for (const at of ["yesterday", "2026-01-01", "2026-13-45T00:00:00Z", "2026-01-01 00:00:00Z", " 2026-01-01T00:00:00Z"])
      expect(invalid({ ...ev, at })).toBe(true);
    for (const at of ["2026-01-01T00:00:00.123Z", "2026-01-01T00:00:00+05:30"]) expect(invalid({ ...ev, at })).toBe(false);
  });
  it("rejects NUL and lone surrogates in string fields, accepts astral pairs", () => {
    for (const v of ["a\u0000b", "\ud800", "x\udc00", "\ud800a"]) expect(invalid({ ...ev, target: v })).toBe(true);
    expect(invalid({ ...ev, target: "😀é中" })).toBe(false);
    expect(invalid({ ...ev, detail: { k: "\ud800\u0000" } })).toBe(false); // escaped by JSON, safe
  });
  it("rejects unknown fields", () => expect(invalid({ ...ev, extra: 1 })).toBe(true));
  it("rejects bad detail", () => {
    for (const d of [null, [], "s", 3]) expect(invalid({ ...ev, detail: d })).toBe(true);
    expect(invalid({ ...ev, detail: { n: Number.NaN } })).toBe(true);
    expect(invalid({ ...ev, detail: { n: Number.POSITIVE_INFINITY } })).toBe(true);
    const c: Record<string, unknown> = {}; c.self = c;
    expect(invalid({ ...ev, detail: c })).toBe(true);
  });
  it("rejects huge detail but accepts the cap", () => {
    const wrap = (n: number) => ({ ...ev, detail: { k: "x".repeat(n) } });
    const overhead = '{"k":""}'.length;
    expect(invalid(wrap(MAX_DETAIL - overhead + 1))).toBe(true);
    expect(invalid(wrap(MAX_DETAIL - overhead))).toBe(false);
  });
  it("accepts undefined detail", () => expect(invalid({ ...ev, detail: undefined })).toBe(false));
});

describe("hashEvent", () => {
  it("is 64 hex chars and deterministic", () => {
    expect(hashEvent(GENESIS, ev)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvent(GENESIS, ev)).toBe(hashEvent(GENESIS, { ...ev }));
  });
  it("matches the known vector sha256(prev + canonical)", () =>
    expect(hashEvent(GENESIS, ev)).toBe("d3f52a3c6a474a4ff01ecc243a0fe965f5c2afaff4f35548d831ce66a9625abd"));
  it("depends on prev and on every field", () => {
    const base = hashEvent(GENESIS, ev);
    expect(hashEvent("1".repeat(64), ev)).not.toBe(base);
    for (const k of ["tenantId", "actor", "action", "target", "at"]) expect(hashEvent(GENESIS, { ...ev, [k]: "z" })).not.toBe(base);
    expect(hashEvent(GENESIS, { ...ev, detail: {} })).not.toBe(base);
  });
  it("ignores detail key order, handles unicode and nesting", () => {
    const a = { ...ev, detail: { z: 1, a: { y: "é😀", x: [1, { q: 1, p: 2 }] } } };
    const b = { ...ev, detail: { a: { x: [1, { p: 2, q: 1 }], y: "é😀" }, z: 1 } };
    expect(hashEvent(GENESIS, a)).toBe(hashEvent(GENESIS, b));
  });
});
