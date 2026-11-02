import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

const many = (n: number) => Array.from({ length: n }, (_, i) => doc(`f${String(i).padStart(2, "0")}`));

describe("reap guard in a run", () => {
  it("an empty complete listing reports reapSkipped and keeps every document", async () => {
    const s = setup(many(3));
    await s.ingestion.runOnce("acme");
    s.set([]);
    const counts = await s.ingestion.runOnce("acme");
    expect(counts.reapSkipped).toEqual({ reason: "empty-listing", wouldDelete: 3, known: 3 });
    expect(counts.indexed).toBe(0);
    expect(s.rows().filter((p) => p.deletedAt === null)).toHaveLength(3);
  });

  it("a mass deletion above the fraction is skipped and logged", async () => {
    const warnings: Array<[string, unknown]> = [];
    const s = setup(many(12), undefined, undefined, { warn: (msg, fields) => warnings.push([msg, fields]) });
    await s.ingestion.runOnce("acme");
    s.set(many(4));
    const counts = await s.ingestion.runOnce("acme");
    expect(counts.reapSkipped).toEqual({ reason: "too-many", wouldDelete: 8, known: 12 });
    expect(warnings).toEqual([["reap skipped", { tenantId: "acme", reason: "too-many", wouldDelete: 8, known: 12 }]]);
    expect(s.rows().filter((p) => p.deletedAt === null)).toHaveLength(12);
  });

  it("a deletion within the fraction still reaps and omits reapSkipped", async () => {
    const s = setup(many(12));
    await s.ingestion.runOnce("acme");
    s.set(many(8));
    const counts = await s.ingestion.runOnce("acme");
    expect(counts.reapSkipped).toBeUndefined();
    expect(counts.indexed).toBe(4);
    expect(s.rows().filter((p) => p.deletedAt === null)).toHaveLength(8);
  });

  it("a seeded restart with an empty listing does not wipe the registry", async () => {
    const s = setup(many(3));
    await s.ingestion.runOnce("acme");
    s.set([]);
    const ids = s.rows().map((p) => p.id);
    const counts = await s.reopen(() => ids).runOnce("acme");
    expect(counts.reapSkipped?.reason).toBe("empty-listing");
    expect(s.rows().filter((p) => p.deletedAt === null)).toHaveLength(3);
  });

  it("reapGuard false allows deleting everything", async () => {
    const s = setup(many(3), undefined, undefined, { reapGuard: false });
    await s.ingestion.runOnce("acme");
    s.set([]);
    const counts = await s.ingestion.runOnce("acme");
    expect(counts.reapSkipped).toBeUndefined();
    expect(s.rows().filter((p) => p.deletedAt === null)).toHaveLength(0);
  });
});
