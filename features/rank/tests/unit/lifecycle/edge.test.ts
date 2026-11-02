import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";

const asker = { principals: ["company"] };
const seeded = () => {
  const ix = open();
  ix.index([doc("a", { title: "alpha", body: "near and or not" }), doc("b", { title: "beta" })]);
  return ix;
};

describe("size and shape", () => {
  it("survives a one megabyte query", () => {
    const query = `alpha ${"z".repeat(1_000_000)}`;
    expect(
      seeded()
        .search({ query, asker })
        .map((h) => h.id),
    ).toEqual(["a"]);
  });
  it("survives many distinct terms by keeping 32", () => {
    const query = Array.from({ length: 5000 }, (_, i) => `t${i}`).join(" ");
    expect(seeded().search({ query, asker })).toEqual([]);
  });
  it("indexes a one megabyte body", () => {
    const ix = open();
    ix.index([doc("big", { body: `${"lorem ".repeat(170_000)} needle` })]);
    expect(ix.search({ query: "needle", asker }).map((h) => h.id)).toEqual(["big"]);
  });
  it("handles empty title, path-less words and body", () => {
    const ix = open();
    ix.index([doc("e", { title: "", body: "", path: "/" })]);
    expect(ix.search({ query: "e", asker })).toEqual([]);
  });
  it("handles emoji, RTL, and astral characters", () => {
    const ix = open();
    ix.index([doc("u", { title: "שלום 𝔘𝔫𝔦 résumé 🙂ok" })]);
    for (const q of ["שלום", "𝔘𝔫𝔦", "RÉSUMÉ", "ok"]) expect(ix.search({ query: q, asker }).map((h) => h.id)).toEqual(["u"]);
  });
  it("keeps a thousand docs searchable and k bounded", () => {
    const ix = open();
    ix.index(Array.from({ length: 1000 }, (_, i) => doc(`d${i}`, { title: `word${i % 10}` })));
    expect(ix.search({ query: "word3", asker, k: 100 })).toHaveLength(100);
  });
  it("returns the same answer for the same question", () => {
    const ix = seeded();
    expect(ix.search({ query: "alpha beta", asker })).toEqual(ix.search({ query: "alpha beta", asker }));
  });
});
