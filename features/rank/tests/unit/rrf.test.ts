import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rrf } from "../../src/index.js";

describe("rrf", () => {
  it("sums 1 / (60 + rank) per list, ranks from 1", () => {
    const out = rrf([
      ["a", "b", "c"],
      ["c", "a"],
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(out[0]?.score).toBeCloseTo(1 / 61 + 1 / 62, 12);
    expect(out[1]?.score).toBeCloseTo(1 / 63 + 1 / 61, 12);
    expect(out[2]?.score).toBeCloseTo(1 / 62, 12);
  });
  it("breaks score ties by id", () => {
    expect(
      rrf([
        ["b", "a"],
        ["a", "b"],
      ]).map((x) => x.id),
    ).toEqual(["a", "b"]);
  });
  it("counts an id once per list, at its first rank", () => {
    const out = rrf([["a", "a", "b"]]);
    expect(out).toEqual([
      { id: "a", score: 1 / 61 },
      { id: "b", score: 1 / 63 },
    ]);
  });
  it("takes a custom k", () => {
    expect(rrf([["a"]], 1)[0]?.score).toBeCloseTo(0.5, 12);
  });
  it("returns nothing for no lists or empty lists", () => {
    expect(rrf([])).toEqual([]);
    expect(rrf([[], []])).toEqual([]);
  });
  it("rejects a k that is not a positive finite number", () => {
    for (const k of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => rrf([["a"]], k)).toThrow(RangeError);
  });
  it("never invents ids and does not depend on list order", () => {
    const lists = fc.array(fc.array(fc.constantFrom("a", "b", "c", "d"), { maxLength: 5 }), { maxLength: 4 });
    fc.assert(
      fc.property(lists, (ls) => {
        const out = rrf(ls);
        const seen = new Set<string>(ls.flat());
        expect(out.every((x) => seen.has(x.id))).toBe(true);
        expect(out).toHaveLength(seen.size);
        const rev = new Map(rrf([...ls].reverse()).map((x) => [x.id, x.score]));
        for (const x of out) expect(rev.get(x.id)).toBeCloseTo(x.score, 12);
      }),
    );
  });
});
