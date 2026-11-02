import { describe, expect, it } from "vitest";
import { compare, snapshot } from "../../src/baseline.ts";

const f = (file: string, rule = "r") => ({ file, rule, line: 1 });

describe("ratchet", () => {
  it("passes when findings match the baseline", () => {
    expect(compare([f("a")], snapshot([f("a")]))).toEqual([]);
  });
  it("fails on a new finding or a higher count", () => {
    expect(compare([f("a"), f("b")], { "a:r": 1 })).toEqual(["new: b:r x1"]);
    expect(compare([f("a"), f("a")], { "a:r": 1 })).toEqual(["new: a:r x1"]);
  });
  it("fails when a baseline entry is gone so the file shrinks", () => {
    expect(compare([], { "a:r": 1 })).toEqual(["stale baseline, remove or lower: a:r"]);
  });
});
