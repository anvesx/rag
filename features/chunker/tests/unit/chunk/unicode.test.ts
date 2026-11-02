import { describe, expect, it } from "vitest";
import { chunkText } from "../../../src/chunk.js";
import { expectIdentity, hasLoneSurrogate, uncoveredNonSpace } from "../../support/assertions.js";

describe("unicode", () => {
  it("never cuts a surrogate pair in emoji text with no separators", async () => {
    const text = "😀".repeat(200);
    const chunks = await chunkText("d", text, { size: 7, overlap: 2 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(hasLoneSurrogate(c.text)).toBe(false);
    expectIdentity(text, chunks);
  });
  it("round-trips CJK text with exact coverage", async () => {
    const text = "中文文档也需要被切分。每一段文字都要保留准确的位置信息".repeat(20);
    const chunks = await chunkText("d", text, { size: 30, overlap: 5 });
    expectIdentity(text, chunks);
    expect(uncoveredNonSpace(text, chunks)).toEqual([]);
  });
  it("keeps mixed emoji and CJK intact", async () => {
    const text = "🚀 発表 ✅ 완료 📌 ".repeat(40);
    const chunks = await chunkText("d", text, { size: 11, overlap: 3 });
    for (const c of chunks) expect(hasLoneSurrogate(c.text)).toBe(false);
    expectIdentity(text, chunks);
  });
});
