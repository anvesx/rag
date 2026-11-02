import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chunkId } from "../../src/chunk.js";

describe("chunkId", () => {
  it("equals sha256 of the JSON-encoded [docId, index, text] tuple", () => {
    const expected = createHash("sha256").update('["doc",0,"abc"]', "utf8").digest("hex");
    expect(chunkId("doc", 0, "abc")).toBe(expected);
  });
  it("is unambiguous when the docId or text contain colons", () => {
    expect(chunkId("a:1", 0, "x")).not.toBe(chunkId("a", 1, "0:x"));
    expect(chunkId("a", 10, "x")).not.toBe(chunkId("a:1", 0, "x"));
  });
  it("keeps lone surrogates distinct", () => {
    expect(chunkId("d", 0, "\ud800")).not.toBe(chunkId("d", 0, "\ud801"));
  });
  it("is 64 lowercase hex characters", () => {
    expect(chunkId("d", 3, "text")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    expect(chunkId("d", 3, "text")).toBe(chunkId("d", 3, "text"));
  });
  it("changes when the docId, index or text changes", () => {
    const base = chunkId("d", 3, "text");
    expect(chunkId("e", 3, "text")).not.toBe(base);
    expect(chunkId("d", 4, "text")).not.toBe(base);
    expect(chunkId("d", 3, "Text")).not.toBe(base);
  });
  it("handles unicode text", () => {
    expect(chunkId("d", 0, "中文😀")).toMatch(/^[0-9a-f]{64}$/);
  });
});
