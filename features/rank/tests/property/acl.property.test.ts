import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { askerArb, docArb, indexed, queryArb, use } from "../support/docs.js";
import { oracle } from "../support/oracle.js";

const docs = fc.array(docArb, { maxLength: 12 });
const permitted = (all: readonly { id: string; principals: string[] }[], principals: string[]) => {
  const latest = new Map(all.map((d) => [d.id, d]));
  return new Set([...latest.values()].filter((d) => d.principals.some((p) => principals.includes(p))).map((d) => d.id));
};

describe("random ACL graphs", () => {
  it("results are a subset of the permitted docs", () => {
    fc.assert(
      fc.property(docs, askerArb, queryArb, (all, principals, query) => {
        const ok = permitted(all, principals);
        const hits = indexed(all, { query, asker: { principals }, k: 100 });
        expect(hits.every((h) => ok.has(h.id))).toBe(true);
        expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length);
      }),
      { numRuns: 300 },
    );
  });
  it("matches the brute-force oracle: same ids, order and scores", () => {
    fc.assert(
      fc.property(docs, askerArb, queryArb, (all, principals, query) => {
        const got = indexed(all, { query, asker: { principals }, k: 100 });
        const want = oracle(all, principals, query, 100);
        expect(got.map((h) => h.id)).toEqual(want.map((h) => h.id));
        got.forEach((h, i) => {
          expect(h.path).toBe(want[i]?.path);
          expect(h.score).toBeCloseTo(want[i]?.score ?? Number.NaN, 9);
          expect(h.signals.text).toBeCloseTo(want[i]?.signals.text ?? Number.NaN, 9);
          expect(h.signals.recency).toBeCloseTo(want[i]?.signals.recency ?? Number.NaN, 9);
          expect(h.signals.links).toBeCloseTo(want[i]?.signals.links ?? Number.NaN, 9);
        });
      }),
      { numRuns: 400 },
    );
  });
  it("matches the oracle after re-indexing in several batches and removals", () => {
    fc.assert(
      fc.property(docs, docs, fc.array(fc.constantFrom("d1", "d2", "d3"), { maxLength: 3 }), askerArb, queryArb, (first, second, gone, principals, query) => {
        const got = use((ix) => {
          ix.index(first);
          ix.index(second);
          ix.remove(gone);
          return ix.search({ query, asker: { principals }, k: 100 }).map((h) => h.id);
        });
        const live = [...new Map([...first, ...second].map((d) => [d.id, d])).values()].filter((d) => !(gone as string[]).includes(d.id));
        expect(got).toEqual(oracle(live, principals, query, 100).map((h) => h.id));
      }),
      { numRuns: 200 },
    );
  });
});
