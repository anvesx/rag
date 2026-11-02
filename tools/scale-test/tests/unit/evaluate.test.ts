import { describe, expect, it } from "vitest";
import { errorRate, evaluate, LIMITS } from "../../src/thresholds.ts";

const ok = { requests: 1000, errors: 0, p95Ms: 120 };

describe("evaluate", () => {
  it("uses the k6 limits", () => {
    expect(LIMITS).toEqual({ maxErrorRate: 0.01, maxP95Ms: 500 });
  });
  it("passes a healthy run", () => {
    expect(evaluate(ok)).toEqual({ ok: true, violations: [] });
  });
  it("fails at exactly 1% errors and at exactly 500ms (strict less-than)", () => {
    expect(evaluate({ requests: 990, errors: 10, p95Ms: 120 }).ok).toBe(false);
    expect(evaluate({ ...ok, p95Ms: 500 }).ok).toBe(false);
    expect(evaluate({ requests: 991, errors: 9, p95Ms: 499 }).ok).toBe(true);
  });
  it("names every violated threshold", () => {
    const res = evaluate({ requests: 100, errors: 50, p95Ms: 900 });
    expect(res.violations).toHaveLength(2);
    expect(res.violations[0]).toContain("error rate");
    expect(res.violations[1]).toContain("p95");
  });
  it("fails a run that made no requests", () => {
    expect(evaluate({ requests: 0, errors: 0, p95Ms: 0 }).ok).toBe(false);
  });
  it("computes the error rate over attempts", () => {
    expect(errorRate({ requests: 90, errors: 10, p95Ms: 0 })).toBe(0.1);
  });
});
