import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/chunk.js";
import { expectIdentity, uncoveredNonSpace } from "../support/assertions.js";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/sample.md", import.meta.url)), "utf8");

describe("markdown fixture", () => {
  it("chunks at the default size with exact offsets and full coverage", async () => {
    const chunks = await chunkText("sample.md", fixture);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expectIdentity(fixture, chunks);
    expect(uncoveredNonSpace(fixture, chunks)).toEqual([]);
  });
  it("covers the fixture at a small size with many boundaries", async () => {
    const chunks = await chunkText("sample.md", fixture, { size: 200, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(15);
    expectIdentity(fixture, chunks);
    expect(uncoveredNonSpace(fixture, chunks)).toEqual([]);
  });
  it("keeps the final words of the document in the last chunk", async () => {
    const chunks = await chunkText("sample.md", fixture, { size: 200, overlap: 20 });
    const last = chunks[chunks.length - 1];
    expect(last?.end).toBe(fixture.trimEnd().length);
    expect(last?.text).toContain("ordinary words");
  });
  it("gives the same ids when the fixture is re-chunked", async () => {
    const a = await chunkText("sample.md", fixture);
    const b = await chunkText("sample.md", fixture);
    expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id));
  });
  it("changes only the ids of chunks whose text changed after an edit", async () => {
    const edited = fixture.replace("Operational limits", "Operational ceilings");
    const before = await chunkText("sample.md", fixture, { size: 200, overlap: 20 });
    const after = await chunkText("sample.md", edited, { size: 200, overlap: 20 });
    const changed = after.filter((c, i) => c.id !== before[i]?.id);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(after.length);
    expectIdentity(edited, after);
  });
});
