/** ink[i] = count of non-whitespace chars in text[0, i); a range is blank iff its ink is equal at both ends. */
export function inkPrefix(text: string): Uint32Array {
  const ink = new Uint32Array(text.length + 1);
  for (let i = 0; i < text.length; i++) ink[i + 1] = (ink[i] as number) + ((text[i] as string).trim() === "" ? 0 : 1);
  return ink;
}

/** Next occurrence at or after `from` that keeps the placement valid, or -1. */
export function nextCandidate(
  text: string,
  piece: string,
  from: number,
  prevStart: number,
  prevEnd: number,
  first: boolean,
  blank: (a: number, b: number) => boolean,
  isDead: (start: number) => boolean,
): number {
  for (let at = text.indexOf(piece, from); at >= 0; at = text.indexOf(piece, at + 1)) {
    if (at > prevEnd && !blank(prevEnd, at)) return -1;
    if (first && at > 0 && !blank(0, at)) return -1;
    if (at >= prevStart && at + piece.length >= prevEnd && !isDead(at)) return at;
  }
  return -1;
}
