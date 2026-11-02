import { describe, expect, it } from "vitest";
import { chunkText } from "../../../src/chunk.js";
import { expectIdentity, uncoveredNonSpace } from "../../support/assertions.js";
import { words } from "../../support/words.js";

describe("chunkText basics", () => {
  it("returns [] for empty and whitespace-only text", async () => {
    expect(await chunkText("d", "")).toEqual([]);
    expect(await chunkText("d", " \n\t  ")).toEqual([]);
  });
  it("returns one chunk with exact fields for short text", async () => {
    const chunks = await chunkText("doc-1", "hello world");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ docId: "doc-1", index: 0, text: "hello world", start: 0, end: 11 });
    expect(chunks[0]?.id).toMatch(/^[0-9a-f]{64}$/);
  });
  it("numbers chunks 0..n-1 and tags every chunk with the docId", async () => {
    const chunks = await chunkText("d9", words(300), { size: 40, overlap: 8 });
    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.docId).toBe("d9");
    });
  });
  it("never produces a chunk longer than size", async () => {
    const chunks = await chunkText("d", words(500), { size: 50, overlap: 10 });
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(50);
  });
  it("uses size 1000 and overlap 100 when options are omitted", async () => {
    const text = words(1000);
    const byDefault = await chunkText("d", text);
    expect(byDefault).toEqual(await chunkText("d", text, { size: 1000, overlap: 100 }));
    expect(byDefault.length).toBeGreaterThan(1);
    for (const c of byDefault) expect(c.text.length).toBeLessThanOrEqual(1000);
  });
  it("gives consecutive chunks an overlap no larger than the overlap option", async () => {
    const chunks = await chunkText("d", words(500), { size: 50, overlap: 10 });
    let overlapping = 0;
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const next = chunks[i];
      if (!prev || !next) throw new Error("missing chunk");
      const shared = prev.end - next.start;
      expect(shared).toBeLessThanOrEqual(10);
      if (shared > 0) overlapping++;
    }
    expect(overlapping).toBeGreaterThan(0);
  });
  it("keeps every non-whitespace character covered", async () => {
    const text = words(400);
    const chunks = await chunkText("d", text, { size: 60, overlap: 12 });
    expectIdentity(text, chunks);
    expect(uncoveredNonSpace(text, chunks)).toEqual([]);
  });
});
