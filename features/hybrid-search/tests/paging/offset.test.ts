import type { Acl } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex, MAX_WINDOW, SearchError } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };
const all = { sql: "tenant_id = ?", params: ["ok"] };

/** n chunks that all match "needle"; keyword order (chunk id) and vector order (angle) disagree. */
function seeded(n: number) {
  const index = createSearchIndex(":memory:", 2);
  for (let i = 0; i < n; i += 1) {
    const angle = ((i * 7) % n) / n;
    const tenantId = i % 10 === 9 ? "other" : "ok";
    index.add({ chunkId: `c${String(i).padStart(3, "0")}`, docId: `d${i}`, tenantId, text: "needle", embedding: [1, angle], acl });
  }
  return index;
}
const page = (index: ReturnType<typeof seeded>, offset: number | undefined, limit: number) =>
  index.search({ text: "needle", embedding: [1, 0], limit, acl: all, ...(offset !== undefined && { offset }) }).map((h) => h.chunkId);

describe("search offset", () => {
  it("treats a missing offset and offset 0 alike", () => {
    const index = seeded(30);
    expect(page(index, 0, 5)).toEqual(page(index, undefined, 5));
    expect(page(index, 0, 5)).toHaveLength(5);
  });

  it("keeps the fused order stable: a page equals the same slice of one long page", () => {
    const index = seeded(60);
    const full = page(index, 0, 30);
    expect(full).toHaveLength(30);
    for (const offset of [0, 5, 10, 25]) expect(page(index, offset, 5)).toEqual(full.slice(offset, offset + 5));
  });

  it("returns disjoint consecutive pages (the fusion window does not move with the offset)", () => {
    const index = seeded(40);
    const seen = [...page(index, 0, 10), ...page(index, 10, 10), ...page(index, 20, 10)];
    expect(new Set(seen).size).toBe(30);
  });

  it("returns a short last page and then nothing past the end", () => {
    const index = seeded(30); // 27 visible
    expect(page(index, 25, 10)).toHaveLength(2);
    expect(page(index, 27, 10)).toEqual([]);
    expect(page(index, 500, 10)).toEqual([]);
  });

  it("never returns an ACL-hidden chunk on any page", () => {
    const index = seeded(40);
    const seen = [0, 10, 20, 30].flatMap((offset) => page(index, offset, 10));
    for (const id of seen) expect(Number(id.slice(1)) % 10).not.toBe(9);
  });

  it("ranks past 100 per list, so offsets beyond 100 work", () => {
    const index = seeded(150);
    expect(page(index, 120, 10)).toHaveLength(10);
    expect(page(index, 120, 10)).toEqual(
      page(index, 0, 100)
        .concat(page(index, 100, 30))
        .slice(120, 130),
    );
  });

  it("rejects an invalid offset with a typed error", () => {
    const index = seeded(3);
    for (const offset of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1", null]) {
      expect(() => index.search({ text: "needle", embedding: [1, 0], limit: 1, acl: all, offset: offset as never })).toThrowError(new SearchError("OFFSET"));
    }
  });

  it("documents the window cap: offset+limit up to MAX_WINDOW, one more is OFFSET", () => {
    const index = seeded(3);
    expect(MAX_WINDOW).toBeGreaterThan(100);
    expect(page(index, MAX_WINDOW - 100, 100)).toEqual([]);
    expect(() => page(index, MAX_WINDOW - 99, 100)).toThrowError(new SearchError("OFFSET"));
    for (const limit of [0, 101]) expect(() => page(index, 0, limit)).toThrowError(new SearchError("LIMIT"));
  });
});
