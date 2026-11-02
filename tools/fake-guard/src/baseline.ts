import type { Finding } from "./rules.ts";

export type Baseline = Record<string, number>;

const count = (findings: Finding[]): Baseline => {
  const out: Baseline = {};
  for (const f of findings) out[`${f.file}:${f.rule}`] = (out[`${f.file}:${f.rule}`] ?? 0) + 1;
  return out;
};

/** A ratchet: new findings fail, and so do baseline entries that no longer occur, so the file only shrinks. */
export const compare = (findings: Finding[], baseline: Baseline): string[] => {
  const now = count(findings);
  const problems: string[] = [];
  for (const [key, n] of Object.entries(now)) if (n > (baseline[key] ?? 0)) problems.push(`new: ${key} x${n - (baseline[key] ?? 0)}`);
  for (const [key, n] of Object.entries(baseline)) if ((now[key] ?? 0) < n) problems.push(`stale baseline, remove or lower: ${key}`);
  return problems.sort();
};

export const snapshot = count;
