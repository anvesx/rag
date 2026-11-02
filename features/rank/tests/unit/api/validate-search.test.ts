import { describe, expect, it } from "vitest";
import { RankError } from "../../../src/index.js";
import { open } from "../../support/docs.js";
import { bad, codeOf } from "../../support/errors.js";

describe("search validation", () => {
  const ix = open();
  const run =
    (asker: unknown, query: unknown = "a", k?: unknown) =>
    () =>
      ix.search(bad({ query, asker, ...(k === undefined ? {} : { k }) }));
  it.each([
    ["missing asker", undefined],
    ["null asker", null],
    ["no principals field", {}],
    ["empty principals", { principals: [] }],
    ["principals as string", { principals: "company" }],
    ["empty principal", { principals: ["company", ""] }],
    ["non-string principal", { principals: [7] }],
    ["long principal", { principals: ["p".repeat(257)] }],
    ["too many principals", { principals: Array.from({ length: 257 }, (_, i) => `p${i}`) }],
    ["lone surrogate", { principals: ["\udc00"] }],
    ["NUL", { principals: ["a\0"] }],
  ])("fails closed on %s with BAD_ASKER", (_n, asker) => {
    expect(codeOf(run(asker))).toBe("BAD_ASKER");
  });
  it("accepts 256 principals of 256 characters", () => {
    const principals = Array.from({ length: 256 }, (_, i) => `${i}`.padEnd(256, "p"));
    expect(codeOf(run({ principals }))).toBe("none");
  });
  it.each([
    ["number query", 5, undefined],
    ["null query", null, undefined],
    ["k zero", "a", 0],
    ["k 101", "a", 101],
    ["k fractional", "a", 1.5],
    ["k string", "a", "3"],
    ["k NaN", "a", Number.NaN],
  ])("rejects %s with BAD_QUERY", (_n, query, k) => {
    expect(codeOf(run({ principals: ["company"] }, query, k))).toBe("BAD_QUERY");
  });
  it("accepts k at both ends", () => {
    expect(codeOf(run({ principals: ["company"] }, "a", 1))).toBe("none");
    expect(codeOf(run({ principals: ["company"] }, "a", 100))).toBe("none");
  });
  it("checks the asker before the query", () => {
    expect(codeOf(run({ principals: [] }, 5))).toBe("BAD_ASKER");
  });
  it("carries a readable error name and message", () => {
    try {
      run({ principals: [] })();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RankError);
      expect((e as Error).name).toBe("RankError");
      expect((e as Error).message).toMatch(/principals/);
    }
  });
});
