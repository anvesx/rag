import { inkPrefix, nextCandidate } from "./candidates.js";
import { ChunkError } from "./errors.js";

export type Located = { text: string; start: number; end: number };

/**
 * Places the library's ordered pieces in the source text. The library trims
 * whitespace, so a piece can only be recovered by search. A valid placement has
 * these properties, which the library guarantees for its own output:
 * starts and ends never decrease, and the text between two pieces (and before the
 * first and after the last) is whitespace only. The search is a depth-first
 * backtracking over candidate occurrences with a memo of dead (piece, start) states,
 * so it is complete: if the pieces came from the text, a placement is found.
 * OFFSET_LOST is an internal-invariant error for pieces that cannot be placed.
 */
export function locate(text: string, pieces: readonly string[], overlap = Infinity): Located[] {
  if (overlap === Infinity) return search(text, pieces, Infinity);
  try {
    return search(text, pieces, overlap);
  } catch {
    return search(text, pieces, Infinity);
  }
}

/** Candidates are tried from `prevEnd - slack` first: the splitter never overlaps more than its overlap. */
function search(text: string, pieces: readonly string[], slack: number): Located[] {
  const n = pieces.length;
  if (n === 0) return [];
  if (pieces.some((p) => p.length === 0)) throw lost(pieces.findIndex((p) => p.length === 0));
  const starts: number[] = new Array<number>(n).fill(0);
  const from: number[] = new Array<number>(n).fill(0);
  const dead = new Set<string>();
  const ink = inkPrefix(text);
  const blank = (a: number, b: number) => ink[b] === ink[a];
  let i = 0;
  let deepest = 0;
  while (i >= 0) {
    const piece = pieces[i] as string;
    const prevStart = i === 0 ? 0 : (starts[i - 1] as number);
    const prevEnd = i === 0 ? 0 : prevStart + (pieces[i - 1] as string).length;
    const at = nextCandidate(text, piece, Math.max(from[i] as number, prevEnd - slack), prevStart, prevEnd, i === 0, blank, (s) => dead.has(`${i}:${s}`));
    if (at < 0 || (i === n - 1 && !blank(at + piece.length, text.length))) {
      if (at >= 0) {
        from[i] = at + 1;
        continue;
      }
      i--;
      if (i >= 0) dead.add(`${i}:${starts[i]}`);
      continue;
    }
    starts[i] = at;
    from[i] = at + 1;
    deepest = Math.max(deepest, i);
    if (i === n - 1) break;
    i++;
    from[i] = at;
  }
  if (i < 0) throw lost(deepest + 1);
  return pieces.map((p, k) => ({ text: p, start: starts[k] as number, end: (starts[k] as number) + p.length }));
}

const lost = (k: number) => new ChunkError("OFFSET_LOST", `piece ${k} cannot be located in source text`);
