import type { Pointer } from "@anvesx/core-types";
import type { Registry } from "@rag/pointer-registry";
import { describe, expect, it } from "vitest";
import { liveIds } from "../../src/runtime/known.js";

const row = (id: string, deletedAt: string | null = null) => ({ id, deletedAt }) as Pointer;

/** A registry stub that pages like the real one: ordered by id, strictly after `afterId`, at most `limit` rows. */
function stub(rows: Pointer[]) {
  const calls: Array<{ afterId?: string; limit?: number }> = [];
  const registry = {
    list: (q: { afterId?: string; limit?: number }) => {
      calls.push(q);
      return rows.filter((r) => r.id > (q.afterId ?? "")).slice(0, q.limit);
    },
  } as unknown as Registry;
  return { registry, calls };
}

describe("liveIds", () => {
  it("is empty for an empty registry after one call", () => {
    const { registry, calls } = stub([]);
    expect(liveIds(registry, "t")).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("pages with afterId until exhausted and returns every id once", () => {
    const rows = Array.from({ length: 2500 }, (_, i) => row(String(i).padStart(5, "0")));
    const { registry, calls } = stub(rows);
    const ids = liveIds(registry, "t");
    expect(ids).toEqual(rows.map((r) => r.id));
    expect(calls.map((c) => c.afterId)).toEqual([undefined, "00999", "01999"]);
  });

  it("an exact multiple of the page size ends on an empty page", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(String(i).padStart(5, "0")));
    const { registry, calls } = stub(rows);
    expect(liveIds(registry, "t")).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("keeps only rows with deletedAt === null", () => {
    const { registry } = stub([row("a"), row("b", "2026-01-01T00:00:00.000Z"), row("c")]);
    expect(liveIds(registry, "t")).toEqual(["a", "c"]);
  });
});
