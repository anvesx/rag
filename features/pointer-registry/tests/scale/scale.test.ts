import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { hashOf, ptr } from "../fixtures.js";

// Stryker re-runs tests per mutant; the 100k scale run is skipped there (it measures speed, not logic).
describe.skipIf(process.env["STRYKER_MUTATOR_WORKER"] !== undefined)("scale", () => {
  it("100k upserts under 30 s; list page under 20 ms", () => {
    const dir = mkdtempSync(join(tmpdir(), "pr-"));
    try {
      const r = createRegistry(join(dir, "r.db"));
      const t0 = performance.now();
      for (let i = 0; i < 100_000; i++) r.upsert(ptr({ id: `d${String(i).padStart(6, "0")}`, contentHash: hashOf(i) }));
      const upsertMs = performance.now() - t0;
      const t1 = performance.now();
      const page = r.list({ tenantId: "t1", afterId: "d050000", limit: 100 });
      const listMs = performance.now() - t1;
      console.log(`SCALE upsert100k=${Math.round(upsertMs)}ms listPage=${listMs.toFixed(2)}ms`);
      expect(page).toHaveLength(100);
      expect(upsertMs).toBeLessThan(30_000);
      expect(listMs).toBeLessThan(20);
      r.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
