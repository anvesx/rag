import { describe, expect, it } from "vitest";
import { rrf } from "../../src/index.js";

describe("rrf", () => {
  it("sums reciprocal ranks across lists", () => {
    expect(
      rrf([
        ["a", "b"],
        ["b", "c"],
      ]),
    ).toEqual([
      { id: "b", score: 1 / 62 + 1 / 61 },
      { id: "a", score: 1 / 61 },
      { id: "c", score: 1 / 62 },
    ]);
  });

  it("breaks equal-score ties by id and accepts empty lists", () => {
    expect(rrf([[], ["z", "a"]], 1)).toEqual([
      { id: "z", score: 1 / 2 },
      { id: "a", score: 1 / 3 },
    ]);
    expect(rrf([])).toEqual([]);
  });

  it("deduplicates an id within one rank list", () => {
    expect(rrf([["a", "a"]], 0)).toEqual([{ id: "a", score: 1 }]);
  });
});
