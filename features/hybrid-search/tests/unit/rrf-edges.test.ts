import { describe, expect, it } from "vitest";
import { rrf, SearchError } from "../../src/index.js";

describe("rrf edges", () => {
  it("breaks a true score tie by id ascending", () => {
    expect(rrf([["b"], ["a"]])).toEqual([
      { id: "a", score: 1 / 61 },
      { id: "b", score: 1 / 61 },
    ]);
    expect(rrf([["b"], ["a"], ["c"]]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("uses the supplied k", () => {
    expect(rrf([["a"]], 10)).toEqual([{ id: "a", score: 1 / 11 }]);
  });

  it("rejects bad k and bad ids with INPUT", () => {
    expect(() => rrf([["a"]], -1)).toThrowError(new SearchError("INPUT"));
    expect(() => rrf([["a"]], Number.NaN)).toThrowError(new SearchError("INPUT"));
    expect(() => rrf([[""]])).toThrowError(new SearchError("INPUT"));
    expect(() => rrf([[1 as unknown as string]])).toThrowError(new SearchError("INPUT"));
  });

  it("fuses large lists in near-linear time", () => {
    const ids = Array.from({ length: 200_000 }, (_, i) => `id-${i}`);
    const started = performance.now();
    const out = rrf([ids, [...ids].reverse()]);
    expect(out).toHaveLength(200_000);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
