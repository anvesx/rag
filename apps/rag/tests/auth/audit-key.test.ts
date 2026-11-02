import { describe, expect, it } from "vitest";
import { DEMO_AUDIT_KEY, resolveAuditKey } from "../../src/auth/audit-key.js";

const key = "k".repeat(32);
const run = (env: Record<string, string | undefined>) => {
  const warnings: string[] = [];
  return { key: () => resolveAuditKey(env, (m) => warnings.push(m)), warnings };
};

describe("resolveAuditKey", () => {
  it("pure demo mode falls back to the public constant and warns on stderr", () => {
    const r = run({ RAG_DEMO: "1" });
    expect(r.key()).toBe(DEMO_AUDIT_KEY);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("RAG_AUDIT_KEY");
  });
  it("uses a supplied key in demo mode without warning", () => {
    const r = run({ RAG_AUDIT_KEY: "short" });
    expect(r.key()).toBe("short");
    expect(r.warnings).toEqual([]);
  });
  it.each([{ RAG_AUTH_SECRET: "a".repeat(32) }, { RAG_DATA_DIR: "/data" }])("requires the key when %j is set", (env) => {
    expect(() => run(env).key()).toThrow("RAG_AUDIT_KEY");
    expect(() => run({ ...env, RAG_AUDIT_KEY: "" }).key()).toThrow("RAG_AUDIT_KEY");
    expect(() => run({ ...env, RAG_AUDIT_KEY: "k".repeat(31) }).key()).toThrow("at least 32");
    expect(run({ ...env, RAG_AUDIT_KEY: key }).key()).toBe(key);
  });
  it("an empty RAG_DATA_DIR counts as unset, like readEnv", () => {
    expect(run({ RAG_DATA_DIR: "" }).key()).toBe(DEMO_AUDIT_KEY);
  });
  it("never falls back to the constant in persistent mode", () => {
    const r = run({ RAG_DATA_DIR: "/d", RAG_AUDIT_KEY: key });
    expect(r.key()).not.toBe(DEMO_AUDIT_KEY);
    expect(r.warnings).toEqual([]);
  });
});
