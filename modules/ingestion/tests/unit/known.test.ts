import { describe, expect, it } from "vitest";
import { docId } from "../../src/index.js";
import { doc, setup } from "../support/harness.js";

const ids = (...addresses: string[]) => addresses.map((a) => docId("fake", a));

/** Ingests a, b, c; the test then restarts via `s.reopen(known)`. */
async function ingested() {
  const s = setup([doc("a"), doc("b"), doc("c")]);
  await s.ingestion.runOnce("acme");
  return s;
}

describe("known seed", () => {
  it("without it a doc deleted while down stays indexed (the gap)", async () => {
    const s = await ingested();
    s.set([doc("a"), doc("b")]);
    await s.reopen().runOnce("acme");
    expect(s.rows().map((p) => p.address)).toContain("c");
  });

  it("tombstones a seeded doc that the full listing no longer has", async () => {
    const s = await ingested();
    s.set([doc("a"), doc("b")]);
    const counts = await s.reopen(() => ids("a", "b", "c")).runOnce("acme");
    expect(counts).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
    expect(s.registry.get("acme", docId("fake", "c"))).toBeUndefined();
    expect(s.registry.get("acme", docId("fake", "a"))).toBeDefined();
  });

  it("accepts an async seed and passes the tenant", async () => {
    const s = await ingested();
    const seen: string[] = [];
    s.set([doc("a"), doc("b")]);
    const seed = async (t: string) => {
      seen.push(t);
      return ids("c");
    };
    await s.reopen(seed).runOnce("acme");
    expect(seen).toEqual(["acme"]);
    expect(s.registry.get("acme", docId("fake", "c"))).toBeUndefined();
  });

  it("an empty seed tombstones nothing", async () => {
    const s = await ingested();
    s.set([]);
    expect(await s.reopen(() => []).runOnce("acme")).toMatchObject({ emitted: 0, failed: 0 });
    expect(s.rows()).toHaveLength(3);
  });

  it("duplicate ids are tombstoned once", async () => {
    const s = await ingested();
    s.set([doc("a"), doc("b")]);
    const counts = await s.reopen(() => ids("c", "c", "c")).runOnce("acme");
    expect(counts).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
  });

  it("a huge seed of ids the registry lacks is handled without failures", async () => {
    const s = await ingested();
    const many = Array.from({ length: 20000 }, (_, i) => `ghost-${i}`);
    const counts = await s.reopen(() => many, { reapGuard: false }).runOnce("acme");
    expect(counts.emitted).toBe(20000);
    expect(counts.failed).toBe(0);
    expect(s.rows()).toHaveLength(3);
  });
});
