import type { Acl } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/index.js";

const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };

function filled(n: number) {
  const index = createSearchIndex(":memory:", 2);
  for (let i = 0; i < n; i += 1)
    index.add({ chunkId: `c-${i}`, docId: `d-${i}`, tenantId: i === 0 ? "rare" : "t", text: "common", embedding: [1, i / n], acl });
  return index;
}

describe("adversarial inputs", () => {
  it("finds a lone allowed chunk far from the query in 30k rows", { timeout: 60_000 }, () => {
    const index = filled(30_000);
    const started = performance.now();
    const hits = index.search({ text: "", embedding: [1, 0.99], limit: 10, acl: { sql: "tenant_id = ?", params: ["rare"] } });
    expect(hits.map((h) => h.chunkId)).toEqual(["c-0"]);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("handles a 20k-token query without blowing up", { timeout: 60_000 }, () => {
    const index = filled(2_000);
    const text = Array.from({ length: 20_000 }, (_, i) => `t${i}`).join(" ");
    const started = performance.now();
    const hits = index.search({ text, embedding: [1, 0], limit: 10, acl: { sql: "1", params: [] } });
    expect(hits).toHaveLength(10);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
