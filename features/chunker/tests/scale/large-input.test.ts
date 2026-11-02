import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/index.js";

describe("large periodic input", () => {
  it("chunks 1 MB of repeated prose with exact offsets in under 5s", async () => {
    const text = "lorem ipsum dolor sit amet. ".repeat(36000);
    const t0 = Date.now();
    const chunks = await chunkText("d", text);
    expect(Date.now() - t0).toBeLessThan(5000);
    for (const c of chunks) expect(text.slice(c.start, c.end)).toBe(c.text);
  }, 30000);
});
