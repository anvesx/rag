import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/chunk.js";
import { expectIdentity, hasLoneSurrogate, uncoveredNonSpace } from "../support/assertions.js";

describe("offset identity (property)", () => {
  it("text.slice(start, end) === chunk.text for any unicode input", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: "grapheme", maxLength: 300 }), fc.integer({ min: 1, max: 40 }), fc.nat(), async (text, size, ov) => {
        const overlap = ov % size;
        const chunks = await chunkText("prop", text, { size, overlap });
        expectIdentity(text, chunks);
        for (const c of chunks) expect(hasLoneSurrogate(c.text)).toBe(false);
        expect(uncoveredNonSpace(text, chunks)).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});
