import { describe, expect, it } from "vitest";
import { corpus } from "./data/corpus.js";
import { evaluate, golden } from "./run.js";

const PLAIN = { title: 1, path: 1, body: 1 };

describe("golden set", () => {
  it("has at least 40 queries with labels that exist in the corpus and are permitted to the asker", () => {
    const g = golden();
    const docs = new Map(corpus().map((d) => [d.id, d]));
    expect(g.length).toBeGreaterThanOrEqual(40);
    for (const q of g) {
      expect(q.relevant.length).toBeGreaterThan(0);
      for (const id of q.relevant) {
        const d = docs.get(id);
        expect(d, `${q.query}: ${id}`).toBeDefined();
        expect(
          d?.principals.some((p) => q.principals.includes(p)),
          `${q.query}: ${id} must be permitted`,
        ).toBe(true);
      }
    }
  });
});

describe("BM25F against plain bm25 (equal column weights)", () => {
  const field = evaluate();
  const plain = evaluate(PLAIN);
  console.info(`eval bm25f  ${JSON.stringify(field)}\neval plain  ${JSON.stringify(plain)}`);
  it("wins on nDCG@10", () => {
    expect(field.ndcg10).toBeGreaterThan(plain.ndcg10);
  });
  it("does not lose recall@20 or MRR", () => {
    expect(field.recall20).toBeGreaterThanOrEqual(plain.recall20);
    expect(field.mrr).toBeGreaterThanOrEqual(plain.mrr);
  });
  it("is a usable ranker in absolute terms", () => {
    expect(field.ndcg10).toBeGreaterThan(0.8);
  });
});
