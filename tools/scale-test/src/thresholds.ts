/** Same limits as the k6 script in search.js. */
export const LIMITS = { maxErrorRate: 0.01, maxP95Ms: 500 };

export type Stats = { requests: number; errors: number; p95Ms: number };
export type Verdict = { ok: boolean; violations: string[] };

/** Failed attempts over all attempts; `requests` counts completed responses. */
export const errorRate = (s: Stats): number => (s.requests + s.errors === 0 ? 1 : s.errors / (s.requests + s.errors));

export function evaluate(s: Stats, limits = LIMITS): Verdict {
  const violations: string[] = [];
  if (s.requests === 0) violations.push("no requests completed");
  if (!(errorRate(s) < limits.maxErrorRate)) violations.push(`error rate ${(errorRate(s) * 100).toFixed(2)}% is not < ${limits.maxErrorRate * 100}%`);
  if (!(s.p95Ms < limits.maxP95Ms)) violations.push(`p95 ${s.p95Ms}ms is not < ${limits.maxP95Ms}ms`);
  return { ok: violations.length === 0, violations };
}
