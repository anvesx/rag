import type { ReapGuard, ReapSkipped } from "../types.js";

const DEFAULTS = { maxFraction: 0.5, minDocs: 10 };

/**
 * Decides whether a delete pass looks like a mistake rather than a real mass deletion. An empty listing with
 * known documents is always refused; otherwise, with at least `minDocs` known, deleting more than `maxFraction`
 * of them is refused. `false` disables the guard.
 */
export function reapSkip(mine: Map<string, string>, listedIds: Set<string>, guard?: ReapGuard | false): ReapSkipped | undefined {
  if (guard === false) return undefined;
  const { maxFraction, minDocs } = { ...DEFAULTS, ...guard };
  const wouldDelete = [...mine.keys()].filter((id) => !listedIds.has(id)).length;
  const known = mine.size;
  if (wouldDelete === 0) return undefined;
  if (listedIds.size === 0) return { reason: "empty-listing", wouldDelete, known };
  if (known >= minDocs && wouldDelete / known > maxFraction) return { reason: "too-many", wouldDelete, known };
  return undefined;
}
