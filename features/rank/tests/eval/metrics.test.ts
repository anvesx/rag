import { describe, expect, it } from "vitest";
import { mean, mrr, ndcgAt, recallAt } from "./metrics.js";

const set = (...ids: string[]) => new Set(ids);

describe("ndcgAt (hand computed)", () => {
  // ranked a b c d, relevant {b, d}: DCG = 1/log2(3) + 1/log2(5) = 0.6309 + 0.4307 = 1.0616
  // ideal puts both first: 1/log2(2) + 1/log2(3) = 1 + 0.6309 = 1.6309. Ratio 0.6509.
  it("scores a partly right ranking", () => {
    expect(ndcgAt(["a", "b", "c", "d"], set("b", "d"))).toBeCloseTo(0.6509, 4);
  });
  it("is 1 for the ideal order and 0 for none found", () => {
    expect(ndcgAt(["b", "d", "a"], set("b", "d"))).toBe(1);
    expect(ndcgAt(["x", "y"], set("b"))).toBe(0);
  });
  it("is 0 with no labelled relevant docs", () => {
    expect(ndcgAt(["a"], set())).toBe(0);
  });
  it("ignores hits below the cut-off", () => {
    const ranked = Array.from({ length: 12 }, (_, i) => `d${i}`);
    expect(ndcgAt(ranked, set("d10"), 10)).toBe(0);
    // rank 11 (index 10) is inside k = 11: 1/log2(12) = 0.2789 over ideal 1
    expect(ndcgAt(ranked, set("d10"), 11)).toBeCloseTo(0.2789, 4);
  });
  it("caps the ideal at k when more than k docs are relevant", () => {
    const rel = Array.from({ length: 15 }, (_, i) => `r${i}`);
    expect(ndcgAt(rel.slice(0, 10), new Set(rel), 10)).toBe(1);
  });
});

describe("recallAt", () => {
  it("is found over labelled: 10 of 25 relevant in the top 20 gives 0.4", () => {
    const rel = Array.from({ length: 25 }, (_, i) => `r${i}`);
    const ranked = [...rel.slice(0, 10), ...Array.from({ length: 10 }, (_, i) => `x${i}`), ...rel.slice(10)];
    expect(recallAt(ranked, new Set(rel), 20)).toBeCloseTo(0.4, 10);
  });
  it("is 0 for an empty label set", () => {
    expect(recallAt(["a"], set())).toBe(0);
  });
});

describe("mrr", () => {
  it("is 1/rank of the first relevant hit", () => {
    expect(mrr(["x", "y", "b", "d"], set("b", "d"))).toBeCloseTo(1 / 3, 10);
    expect(mrr(["b"], set("b"))).toBe(1);
  });
  it("is 0 when nothing relevant is returned", () => {
    expect(mrr(["x"], set("b"))).toBe(0);
    expect(mrr([], set("b"))).toBe(0);
  });
});

describe("mean", () => {
  it("averages and tolerates empty input", () => {
    expect(mean([1, 2, 6])).toBe(3);
    expect(mean([])).toBe(0);
  });
});
