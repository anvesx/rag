import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { describe, expect, it, vi } from "vitest";
import { chunkText } from "../../src/chunk.js";
import { ChunkError } from "../../src/errors.js";

const caught = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

describe("chunk count limit", () => {
  it.each([100_000, 1_000_000])("rejects size 50 overlap 49 on %i chars with a typed ChunkError", async (n) => {
    const err = await caught(chunkText("d", "x".repeat(n), { size: 50, overlap: 49 }));
    expect(err).toBeInstanceOf(ChunkError);
    expect((err as ChunkError).code).toBe("TOO_MANY_CHUNKS");
    expect((err as ChunkError).message).toContain("chunks");
  });
  it("estimates the count before splitting, at the exact cap", async () => {
    const ok = await chunkText("d", "a".repeat(50_000), { size: 1, overlap: 0 });
    expect(ok).toHaveLength(50_000);
    const err = await caught(chunkText("d", "a".repeat(50_001), { size: 1, overlap: 0 }));
    expect((err as ChunkError).code).toBe("TOO_MANY_CHUNKS");
  });
  it("converts a stack overflow from the splitter into TOO_MANY_CHUNKS and rethrows other errors", async () => {
    const spy = vi.spyOn(RecursiveCharacterTextSplitter.prototype, "splitText");
    spy.mockRejectedValueOnce(new RangeError("Maximum call stack size exceeded"));
    expect(((await caught(chunkText("d", "some text"))) as ChunkError).code).toBe("TOO_MANY_CHUNKS");
    spy.mockRejectedValueOnce(new TypeError("boom"));
    expect(await caught(chunkText("d", "some text"))).toBeInstanceOf(TypeError);
    spy.mockRestore();
  });
  it("still accepts a large overlap on small text", async () => {
    const chunks = await chunkText("d", "abcdefghij".repeat(20), { size: 50, overlap: 49 });
    expect(chunks.length).toBeGreaterThan(100);
  });
});
