import { describe, expect, it } from "vitest";
import { chunkText } from "../../../src/chunk.js";
import { words } from "../../support/words.js";

const opt = { size: 40, overlap: 8 };

describe("determinism and ids", () => {
  it("gives identical ids and offsets for identical input", async () => {
    const a = await chunkText("d", words(200), opt);
    const b = await chunkText("d", words(200), opt);
    expect(b).toEqual(a);
  });
  it("changes every id when the docId changes", async () => {
    const a = await chunkText("d1", words(200), opt);
    const b = await chunkText("d2", words(200), opt);
    expect(a.length).toBe(b.length);
    for (const [i, c] of a.entries()) expect(c.id).not.toBe(b[i]?.id);
  });
  it("gives unique ids within one document", async () => {
    const chunks = await chunkText("d", "ab ".repeat(300), { size: 20, overlap: 4 });
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });
  it("returns the same result when called concurrently", async () => {
    const text = words(300);
    const seq = await chunkText("d", text, opt);
    const par = await Promise.all(Array.from({ length: 5 }, () => chunkText("d", text, opt)));
    for (const r of par) expect(r).toEqual(seq);
  });
});
