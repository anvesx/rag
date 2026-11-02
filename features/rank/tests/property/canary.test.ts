import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { askerArb, doc, docArb, indexed, open, PRINCIPALS, queryArb } from "../support/docs.js";

const everything = "alpha beta gamma deploy payroll naïve 日本語 Привет x";
const canary = doc("canary", {
  title: everything.repeat(5),
  path: "/canary/alpha/beta",
  body: everything.repeat(50),
  principals: ["canary-only"],
  links: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"],
});
const docs = fc.array(docArb, { maxLength: 12 });

describe("a hidden canary doc is invisible", () => {
  it("changes nothing the asker sees: ids, scores, signals, order, count", () => {
    fc.assert(
      fc.property(docs, askerArb, queryArb, (all, principals, query) => {
        const ask = { query, asker: { principals }, k: 100 };
        const base = indexed(all, ask);
        const withCanary = indexed([canary, ...all], ask);
        expect(withCanary).toEqual(base);
      }),
      { numRuns: 300 },
    );
  });
  it("never surfaces the canary to anyone without its principal", () => {
    const ix = open();
    ix.index([canary, doc("pub", { title: "alpha beta" })]);
    for (const principals of [PRINCIPALS, ["canary-onl"], ["canary-only "], ["CANARY-ONLY"]]) {
      const hits = ix.search({ query: everything, asker: { principals }, k: 100 });
      expect(hits.map((h) => h.id)).not.toContain("canary");
    }
    expect(ix.search({ query: "canary", asker: { principals: PRINCIPALS } })).toEqual([]);
  });
  it("is found by the one principal that may read it", () => {
    const ix = open();
    ix.index([canary]);
    expect(ix.search({ query: "alpha", asker: { principals: ["canary-only"] } }).map((h) => h.id)).toEqual(["canary"]);
  });
  it("does not shift a visible hit's score, count, or position, even when stuffed with its terms", () => {
    const a = open();
    const b = open();
    const pub = [doc("p1", { title: "alpha" }), doc("p2", { title: "alpha beta", body: "beta" }), doc("p3", { body: "alpha beta beta" })];
    a.index(pub);
    b.index([...pub, canary, { ...canary, id: "canary2", principals: ["other"] }]);
    const ask = { query: "alpha beta", asker: { principals: ["company"] }, k: 100 };
    expect(b.search(ask)).toEqual(a.search(ask));
    expect(a.search(ask)).toHaveLength(3);
  });
});
