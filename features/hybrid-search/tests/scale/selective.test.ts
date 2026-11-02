import type { Acl } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };
const q = (n: number, tenant: string, limit: number) => ({
  text: "",
  embedding: [1, n],
  limit,
  acl: { sql: "tenant_id = ?", params: [tenant] },
});

describe("selective ACL vector search", () => {
  it("returns the exact nearest allowed rows", () => {
    const index = createSearchIndex(":memory:", 2);
    for (let i = 0; i < 400; i += 1)
      index.add({ chunkId: `c${String(i).padStart(3, "0")}`, docId: `d${i}`, tenantId: i % 2 ? "odd" : "even", text: "t", embedding: [1, i / 400], acl });
    const hits = index.search(q(0, "odd", 5));
    expect(hits.map((h) => h.chunkId)).toEqual(["c001", "c003", "c005", "c007", "c009"]);
  });

  it("falls back to an exact scan past the 4096 knn cap", { timeout: 60_000 }, () => {
    const index = createSearchIndex(":memory:", 2);
    for (let i = 0; i < 5_000; i += 1)
      index.add({ chunkId: `c${i}`, docId: `d${i}`, tenantId: i >= 4_990 ? "few" : "many", text: "t", embedding: [1, i / 5_000], acl });
    const hits = index.search(q(1, "few", 100));
    expect(hits).toHaveLength(10);
    expect(hits[0]?.chunkId).toBe("c4999");
  });

  it("returns fewer hits when the limit exceeds the corpus", () => {
    const index = createSearchIndex(":memory:", 2);
    index.add({ chunkId: "only", docId: "d", tenantId: "t", text: "t", embedding: [1, 0], acl });
    expect(index.search(q(0, "t", 100))).toHaveLength(1);
  });
});
