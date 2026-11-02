import { describe, expect, it } from "vitest";
import { HB, pointer, setup } from "../support/harness.js";

const A = "alpha beta gamma";
const B = "delta epsilon zeta";
const T = { "acme/d1@v1": A, "acme/d1@v2": B };
const v2 = () => pointer({ version: "v2", contentHash: HB });
const del = { type: "delete", tenantId: "acme", id: "d1", at: "2026-02-01T00:00:00.000Z" } as const;

describe("apply lifecycle", () => {
  it("created: stores pointer and chunks", async () => {
    const { svc, registry, has, count } = setup(T);
    const r = await svc.apply({ type: "upsert", pointer: pointer() });
    expect(r).toEqual({ outcome: "created", chunks: 1 });
    expect(registry.get("acme", "d1")?.version).toBe("v1");
    expect(has("acme", "d1", A)).toBe(true);
    expect(count("acme")).toBe(1);
  });

  it("updated: replaces old chunks", async () => {
    const { svc, has, count } = setup(T);
    await svc.apply({ type: "upsert", pointer: pointer() });
    const r = await svc.apply({ type: "upsert", pointer: v2() });
    expect(r).toEqual({ outcome: "updated", chunks: 1 });
    expect(has("acme", "d1", A)).toBe(false);
    expect(has("acme", "d1", B)).toBe(true);
    expect(count("acme")).toBe(1);
  });

  it("unchanged: does nothing and never fetches or embeds", async () => {
    const { svc, calls } = setup(T);
    await svc.apply({ type: "upsert", pointer: pointer() });
    const r = await svc.apply({ type: "upsert", pointer: pointer() });
    expect(r).toEqual({ outcome: "unchanged", chunks: 0 });
    expect(calls).toEqual({ fetch: 1, embed: 1 });
  });

  it("deleted: tombstones pointer and removes chunks; replay is absent", async () => {
    const { svc, registry, count } = setup(T);
    await svc.apply({ type: "upsert", pointer: pointer() });
    expect(await svc.apply(del)).toEqual({ outcome: "deleted", chunks: 0 });
    expect(registry.get("acme", "d1")).toBeUndefined();
    expect(count("acme")).toBe(0);
    expect(await svc.apply(del)).toEqual({ outcome: "absent", chunks: 0 });
  });

  it("delete of an unknown doc is absent, not an error", async () => {
    const { svc } = setup(T);
    expect((await svc.apply({ ...del, id: "zz" })).outcome).toBe("absent");
  });

  it("re-upsert after delete revives and reindexes", async () => {
    const { svc, has } = setup(T);
    await svc.apply({ type: "upsert", pointer: pointer() });
    await svc.apply(del);
    const r = await svc.apply({ type: "upsert", pointer: pointer() });
    expect(r.outcome).toBe("updated");
    expect(has("acme", "d1", A)).toBe(true);
  });

  it("idempotent replay of a full stream ends in the same state", async () => {
    const { svc, has, count } = setup(T);
    for (let i = 0; i < 3; i++) for (const p of [pointer(), v2()]) await svc.apply({ type: "upsert", pointer: p });
    expect(has("acme", "d1", B)).toBe(true);
    expect(count("acme")).toBe(1);
  });
});
