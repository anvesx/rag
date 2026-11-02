import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/chunk.js";
import { expectIdentity, uncoveredNonSpace } from "../support/assertions.js";

const FIVE_MB = 5 * 1024 * 1024;

function makeText(bytes: number): string {
  const parts: string[] = [];
  let len = 0;
  for (let p = 0; len < bytes; p++) {
    const para = Array.from({ length: 40 }, (_, w) => `term${(p * 40 + w) % 997}`).join(" ");
    const block = `## Section ${p}\n\n${para}.\n\n`;
    parts.push(block);
    len += block.length;
  }
  return parts.join("");
}

describe("scale", () => {
  it("chunks 5 MB in under 3 seconds with exact offsets", async () => {
    const text = makeText(FIVE_MB);
    const started = performance.now();
    const chunks = await chunkText("big", text);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(3000);
    expect(chunks.length).toBeGreaterThan(5000);
    expectIdentity(text, chunks);
    expect(uncoveredNonSpace(text, chunks)).toEqual([]);
  }, 60_000);
});
