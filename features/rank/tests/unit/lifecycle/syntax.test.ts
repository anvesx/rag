import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";

const asker = { principals: ["company"] };
const seeded = () => {
  const ix = open();
  ix.index([doc("a", { title: "alpha", body: "near and or not" }), doc("b", { title: "beta" })]);
  return ix;
};

describe("FTS5 syntax is plain text", () => {
  it.each([
    '"',
    '"alpha',
    "alpha*",
    "NEAR(",
    "NEAR(alpha beta, 2)",
    "alpha AND",
    "OR alpha",
    "-alpha",
    "title:alpha",
    "^alpha",
    "alpha)))",
    "(((",
    "{a b}:alpha",
    "alpha NOT",
    "*",
    "'",
    "\\",
    ";DROP TABLE docs;--",
  ])("does not throw on %j", (query) => {
    expect(() => seeded().search({ query, asker })).not.toThrow();
  });
  it("finds the plain word inside syntax noise", () => {
    expect(
      seeded()
        .search({ query: 'NEAR("alpha" *', asker })
        .map((h) => h.id),
    ).toEqual(["a"]);
    expect(
      seeded()
        .search({ query: "alpha*", asker })
        .map((h) => h.id),
    ).toEqual(["a"]);
  });
  it("treats operator words as ordinary terms", () => {
    expect(
      seeded()
        .search({ query: "NEAR", asker })
        .map((h) => h.id),
    ).toEqual(["a"]);
  });
  it("does not widen a query with a wildcard or column filter", () => {
    expect(seeded().search({ query: "*", asker })).toEqual([]);
    expect(seeded().search({ query: "bet*", asker })).toEqual([]);
    expect(
      seeded()
        .search({ query: "title:alpha", asker })
        .map((h) => h.id),
    ).toEqual(["a"]);
  });
});
