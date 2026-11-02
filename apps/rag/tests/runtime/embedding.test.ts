import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { realEmbedding } from "../../src/wire/embedder.js";

const offline = process.env.RAG_EMBEDDER_OFFLINE === "1";
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] as number), 0);

describe("realEmbedding", () => {
  it("reports the package's 384 dimensions without loading the model", () => {
    expect(realEmbedding().dimension).toBe(384);
  });
});

// The real model; set RAG_EMBEDDER_OFFLINE=1 only on a host that cannot download it (same switch as @rag/embedder).
describe.skipIf(offline)("realEmbedding with the real model", () => {
  const cache = mkdtempSync(join(tmpdir(), "rag-model-"));
  afterAll(() => rmSync(cache, { recursive: true, force: true }));

  it("becomes ready, then embeds 384-D unit vectors that rank a paraphrase first", async () => {
    const e = realEmbedding(cache);
    await Promise.all([e.ready(), e.ready()]);
    const [para, other] = await e.embed(["how to change your login credentials", "quarterly revenue report"]);
    const q = await e.embedQuery("reset my password");
    expect(para).toHaveLength(384);
    expect(dot(q, q)).toBeCloseTo(1, 4);
    expect(dot(q, para as number[])).toBeGreaterThan(dot(q, other as number[]));
  }, 300_000);
});
