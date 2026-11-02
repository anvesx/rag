import { describe, expect, it } from "vitest";
import { createRegistry, RegistryError } from "../../src/index.js";
import { ptr } from "../fixtures.js";

const seeded = (n: number) => {
  const r = createRegistry(":memory:");
  for (let i = 0; i < n; i++) r.upsert(ptr({ id: `d${String(i).padStart(4, "0")}` }));
  return r;
};

describe("list paging", () => {
  it("pages by id in stable order with no gaps or repeats", () => {
    const r = seeded(25);
    const seen: string[] = [];
    let after: string | undefined;
    for (;;) {
      const page = r.list(after === undefined ? { tenantId: "t1", limit: 10 } : { tenantId: "t1", limit: 10, afterId: after });
      if (page.length === 0) break;
      seen.push(...page.map((p) => p.id));
      after = page[page.length - 1]?.id;
    }
    expect(seen).toEqual([...seen].sort());
    expect(new Set(seen).size).toBe(25);
  });
  it("afterId is exclusive", () => {
    const r = seeded(3);
    expect(r.list({ tenantId: "t1", afterId: "d0001" }).map((p) => p.id)).toEqual(["d0002"]);
  });
  it("default limit is 100, max is 1000", () => {
    const r = seeded(1100);
    expect(r.list({ tenantId: "t1" })).toHaveLength(100);
    expect(r.list({ tenantId: "t1", limit: 5000 })).toHaveLength(1000);
    expect(r.list({ tenantId: "t1", limit: 1000 })).toHaveLength(1000);
    expect(r.list({ tenantId: "t1", limit: 1 })).toHaveLength(1);
  });
  it.each([0, -1, 1.5, Number.NaN])("limit %s is INVALID", (limit) => {
    const r = seeded(1);
    expect(() => r.list({ tenantId: "t1", limit })).toThrow(RegistryError);
  });
  it("skips tombstoned rows and sorts unicode ids stably", () => {
    const r = createRegistry(":memory:");
    for (const id of ["é", "a", "日本", "b"]) r.upsert(ptr({ id }));
    r.tombstone("t1", "b", "2026-11-02T00:00:00Z");
    const ids = r.list({ tenantId: "t1" }).map((p) => p.id);
    expect(ids).toEqual(["a", "é", "日本"]);
  });
});
