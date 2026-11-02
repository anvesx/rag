import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chunkText } from "../../../src/chunk.js";
import { expectIdentity, hasLoneSurrogate, uncoveredNonSpace } from "../../support/assertions.js";

const ALPHABET = ["a", "b", " ", "\n", "!", " ", "😀", " ", "\n\n"];
const build = (idx: readonly number[]) => idx.map((i) => ALPHABET[i]).join("");

async function check(text: string, size: number, overlap: number): Promise<void> {
  const chunks = await chunkText("p", text, { size, overlap });
  expectIdentity(text, chunks);
  for (const c of chunks) expect(hasLoneSurrogate(c.text)).toBe(false);
  expect(uncoveredNonSpace(text, chunks)).toEqual([]);
}

describe("whitespace-heavy small-alphabet property", () => {
  it("regression: [7,3,0,0,3] with size 4 and overlap 3 (was OFFSET_LOST)", async () => {
    await check(build([7, 3, 0, 0, 3]), 4, 3);
  });
  it("regression: trimmed chunk sharing its start with the next", async () => {
    await check(" !!", 2, 1);
  });
  it("keeps identity, no lone surrogates and coverage (3000 runs)", async () => {
    const idx = fc.array(fc.nat(ALPHABET.length - 1), { maxLength: 60 });
    await fc.assert(
      fc.asyncProperty(idx, fc.integer({ min: 1, max: 9 }), fc.nat(), (a, size, ov) => check(build(a), size, ov % size)),
      { numRuns: 3000 },
    );
  });
});
