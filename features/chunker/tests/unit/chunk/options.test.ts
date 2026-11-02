import { describe, expect, it } from "vitest";
import { chunkText } from "../../../src/chunk.js";
import { ChunkError } from "../../../src/errors.js";

describe("option errors", () => {
  it.each([
    ["size zero", { size: 0, overlap: 0 }, "size"],
    ["negative size", { size: -5, overlap: 0 }, "size"],
    ["fractional size", { size: 2.5, overlap: 0 }, "size"],
    ["NaN size", { size: Number.NaN, overlap: 0 }, "size"],
    ["overlap equal to size", { size: 10, overlap: 10 }, "overlap"],
    ["overlap above size", { size: 10, overlap: 11 }, "overlap"],
    ["negative overlap", { size: 10, overlap: -1 }, "overlap"],
    ["fractional overlap", { size: 10, overlap: 1.5 }, "overlap"],
    ["default overlap >= small size", { size: 50 }, "overlap"],
  ])("%s throws BAD_OPTIONS naming the bad option", async (_name, opt, word) => {
    const err = await chunkText("d", "some text", opt).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ChunkError);
    expect((err as ChunkError).code).toBe("BAD_OPTIONS");
    expect((err as ChunkError).message).toContain(word);
  });
  it("accepts overlap of size minus one and overlap zero", async () => {
    await expect(chunkText("d", "abcdefghij", { size: 10, overlap: 9 })).resolves.toBeDefined();
    await expect(chunkText("d", "abcdefghij", { size: 10, overlap: 0 })).resolves.toBeDefined();
  });
  it("accepts size one", async () => {
    const chunks = await chunkText("d", "abc", { size: 1, overlap: 0 });
    expect(chunks.map((c) => c.text)).toEqual(["a", "b", "c"]);
  });
});

describe("wrong-type input", () => {
  it("rejects non-string text with BAD_OPTIONS", async () => {
    await expect(chunkText("d", null as unknown as string)).rejects.toMatchObject({ code: "BAD_OPTIONS" });
    await expect(chunkText("d", 42 as unknown as string)).rejects.toMatchObject({ code: "BAD_OPTIONS" });
  });
  it("rejects a non-string docId with BAD_OPTIONS", async () => {
    await expect(chunkText(7 as unknown as string, "text")).rejects.toBeInstanceOf(ChunkError);
    await expect(chunkText(undefined as unknown as string, "text")).rejects.toMatchObject({ code: "BAD_OPTIONS" });
  });
  it("validates options before the empty-text shortcut", async () => {
    await expect(chunkText("d", "", { size: 0 })).rejects.toMatchObject({ code: "BAD_OPTIONS" });
  });
  it("names the bad input when docId or text has the wrong type", async () => {
    const docErr = await chunkText(7 as unknown as string, "x").catch((e: unknown) => e);
    const textErr = await chunkText("d", 7 as unknown as string).catch((e: unknown) => e);
    expect((docErr as ChunkError).message).toContain("docId");
    expect((textErr as ChunkError).message).toContain("text");
  });
});
