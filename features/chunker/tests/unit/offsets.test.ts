import { describe, expect, it } from "vitest";
import { ChunkError } from "../../src/errors.js";
import { locate } from "../../src/offsets.js";

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("locate", () => {
  it("returns exact spans for pieces found in order", () => {
    const text = "alpha beta gamma";
    expect(locate(text, ["alpha beta", "beta gamma"])).toEqual([
      { text: "alpha beta", start: 0, end: 10 },
      { text: "beta gamma", start: 6, end: 16 },
    ]);
  });
  it("resolves repeated pieces to successive occurrences", () => {
    const spans = locate("ab ab ab", ["ab", "ab", "ab"]);
    expect(spans.map((s) => s.start)).toEqual([0, 3, 6]);
  });
  it("returns an empty list for no pieces", () => {
    expect(locate("anything", [])).toEqual([]);
  });
  it("throws OFFSET_LOST naming the missing piece index", () => {
    const err = thrown(() => locate("hello", ["hello", "world"]));
    expect(err).toBeInstanceOf(ChunkError);
    expect((err as ChunkError).code).toBe("OFFSET_LOST");
    expect((err as ChunkError).message).toContain("piece 1");
  });
  it("throws OFFSET_LOST when a piece only occurs before the cursor", () => {
    const err = thrown(() => locate("abc def", ["def", "abc"]));
    expect((err as ChunkError).code).toBe("OFFSET_LOST");
  });
  it("lets a piece share the previous start when its end moves further", () => {
    expect(locate(" !!", ["!", "!!"])).toEqual([
      { text: "!", start: 1, end: 2 },
      { text: "!!", start: 1, end: 3 },
    ]);
  });
  it("throws OFFSET_LOST when a piece would end before its predecessor ends", () => {
    const err = thrown(() => locate("ab", ["ab", "a"]));
    expect((err as ChunkError).code).toBe("OFFSET_LOST");
  });
  it("throws OFFSET_LOST when non-whitespace text is left uncovered", () => {
    const err = thrown(() => locate("ab xx cd", ["ab", "cd"]));
    expect((err as ChunkError).code).toBe("OFFSET_LOST");
  });
  it("backtracks off the earliest occurrence when a later piece needs it", () => {
    expect(locate("a  a", ["a", "a"]).map((s) => s.start)).toEqual([0, 3]);
  });
  it("places a repeated piece at its next occurrence, not its first", () => {
    expect(locate("ab ab", ["ab", "ab"]).map((s) => s.start)).toEqual([0, 3]);
  });
  it("regression: trimmed piece after a longer piece with trailing blank", () => {
    expect(locate("a! ", ["a!", "!"]).map((s) => s.start)).toEqual([0, 1]);
  });
  it("regression: repeated pieces with whitespace between them", () => {
    expect(locate("aa aa", ["aa", "a", "a", "aa"]).map((s) => s.start)).toEqual([0, 1, 1, 3]);
  });
  it("throws OFFSET_LOST for an empty piece instead of looping", () => {
    const err = thrown(() => locate("abc", ["ab", ""]));
    expect((err as ChunkError).code).toBe("OFFSET_LOST");
  });
});
