import type { Acl } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/index.js";

// Budget on a dev machine. Shared two-core CI runners measure about 2.5x slower (193 ms vs 76 ms), so CI gets 3x.
const BUDGET_MS = process.env["CI"] ? 450 : 150;
const acl: Acl = { allowUsers: [], allowGroups: [], version: 1 };

describe("100k chunk scale", () => {
  it("queries in under 150 ms", { timeout: 120_000 }, () => {
    const index = createSearchIndex(":memory:", 2);
    for (let i = 0; i < 100_000; i += 1) {
      index.add({ chunkId: `c-${i}`, docId: `d-${i}`, tenantId: "t", text: i === 42 ? "needle" : "haystack", embedding: [i % 2, (i + 1) % 2], acl });
    }
    const samples = Array.from({ length: 5 }, () => {
      const started = performance.now();
      const hits = index.search({ text: "needle", embedding: [1, 0], limit: 10, acl: { sql: "tenant_id = ?", params: ["t"] } });
      expect(hits).toHaveLength(10);
      return performance.now() - started;
    });
    console.info(`hybrid-search scale: 100000 chunks, 5 runs, ${samples.map((ms) => ms.toFixed(2)).join(", ")} ms`);
    expect(Math.max(...samples)).toBeLessThan(BUDGET_MS);
  });
});
