import { describe, expect, it } from "vitest";
import { createEmbedder, DIMENSIONS } from "../src/index.js";

const offline = process.env.RAG_EMBEDDER_OFFLINE === "1";
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] as number), 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));

describe.skipIf(offline)("real model (set RAG_EMBEDDER_OFFLINE=1 only when it cannot be downloaded)", () => {
  const e = createEmbedder({ batchSize: 2 });

  it("returns 384-D unit vectors in input order across batches", async () => {
    const texts = ["alpha", "beta", "gamma", "delta", "epsilon"];
    const vs = await e.embed(texts);
    expect(vs).toHaveLength(5);
    for (const v of vs) {
      expect(v).toHaveLength(DIMENSIONS);
      expect(DIMENSIONS).toBe(384);
      expect(norm(v)).toBeCloseTo(1, 4);
    }
    expect(await e.embed([texts[3] as string])).toEqual([vs[3]]);
  });

  it("ranks a paraphrase above an unrelated text", async () => {
    const q = await e.embedQuery("reset my password");
    const [para, other] = await e.embed(["how to change your login credentials", "quarterly revenue report"]);
    expect(dot(q, para as number[])).toBeGreaterThan(dot(q, other as number[]) + 0.1);
  });

  it("embed and embedQuery agree for the same text", async () => {
    const [a] = await e.embed(["hello world"]);
    expect(dot(await e.embedQuery("hello world"), a as number[])).toBeCloseTo(1, 4);
  });

  it("handles an empty batch", async () => {
    expect(await e.embed([])).toEqual([]);
  });
});

describe("options", () => {
  it("rejects a bad batch size", () => {
    expect(() => createEmbedder({ batchSize: 0 })).toThrow(RangeError);
  });

  it("times out", async () => {
    const e = createEmbedder({ timeoutMs: 1, cacheDir: "/nonexistent-cache-for-timeout-test" });
    await expect(e.embedQuery("x")).rejects.toThrow(/timed out/);
  });
});
