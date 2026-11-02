import { expect } from "vitest";
import type { Chunk } from "../../src/chunk.js";

/** Every chunk's offsets must reproduce its text exactly from the source. */
export function expectIdentity(text: string, chunks: readonly Chunk[]): void {
  for (const c of chunks) {
    expect(text.slice(c.start, c.end)).toBe(c.text);
    expect(c.end).toBeGreaterThan(c.start);
  }
}

/** Indexes of non-whitespace code units that no chunk covers. Empty means full coverage. */
export function uncoveredNonSpace(text: string, chunks: readonly Chunk[]): number[] {
  const covered = new Uint8Array(text.length);
  for (const c of chunks) covered.fill(1, c.start, c.end);
  const missing: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (covered[i] === 0 && !/\s/.test(text.charAt(i))) missing.push(i);
  }
  return missing;
}

/** True when the string holds a surrogate that is not part of a valid pair. */
export function hasLoneSurrogate(s: string): boolean {
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
}
