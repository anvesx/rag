import { describe, expect, it } from "vitest";
import { reapSkip } from "../../src/pipeline/guard.js";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `d${i}`);
const map = (list: string[]) => new Map(list.map((id) => [id, id]));

describe("reapSkip", () => {
  it("skips an empty listing when anything is known", () => {
    expect(reapSkip(map(ids(3)), new Set())).toEqual({ reason: "empty-listing", wouldDelete: 3, known: 3 });
  });
  it("does not skip when nothing is known or nothing is missing", () => {
    expect(reapSkip(new Map(), new Set())).toBeUndefined();
    expect(reapSkip(map(ids(3)), new Set(ids(3)))).toBeUndefined();
  });
  it("below the minimum doc count any partial deletion is allowed", () => {
    expect(reapSkip(map(ids(9)), new Set(["d0"]))).toBeUndefined();
  });
  it("at the minimum, deleting more than half is refused", () => {
    expect(reapSkip(map(ids(10)), new Set(ids(4)))).toEqual({ reason: "too-many", wouldDelete: 6, known: 10 });
  });
  it("deleting exactly the fraction is allowed", () => {
    expect(reapSkip(map(ids(10)), new Set(ids(5)))).toBeUndefined();
  });
  it("honours a configured fraction and minimum", () => {
    expect(reapSkip(map(ids(4)), new Set(ids(3)), { maxFraction: 0.2, minDocs: 4 })).toMatchObject({ reason: "too-many" });
    expect(reapSkip(map(ids(3)), new Set(ids(2)), { maxFraction: 0.2, minDocs: 4 })).toBeUndefined();
    expect(reapSkip(map(ids(10)), new Set(ids(1)), { maxFraction: 1 })).toBeUndefined();
  });
  it("false disables the guard, including for an empty listing", () => {
    expect(reapSkip(map(ids(20)), new Set(), false)).toBeUndefined();
  });
  it("counts only known ids missing from the listing", () => {
    expect(reapSkip(map(ids(10)), new Set([...ids(4), "other"]))).toMatchObject({ wouldDelete: 6 });
  });
});
