import type { Pointer } from "@brain/core-types";
import type { Registry } from "@rag/pointer-registry";
import { describe, expect, it } from "vitest";
import { liveIds } from "../../src/runtime/known.js";

const row = (id: string, source: string, deletedAt: string | null = null) => ({ id, source, deletedAt }) as Pointer;
const registry = (rows: Pointer[]) =>
  ({ list: (q: { afterId?: string; limit?: number }) => rows.filter((r) => r.id > (q.afterId ?? "")).slice(0, q.limit) }) as unknown as Registry;

describe("liveIds with a source", () => {
  const rows = [row("a", "folder"), row("b", "other"), row("c", "folder"), row("d", "folder", "2026-01-01T00:00:00.000Z")];
  it("returns only live pointers of that source", () => {
    expect(liveIds(registry(rows), "t", "folder")).toEqual(["a", "c"]);
    expect(liveIds(registry(rows), "t", "other")).toEqual(["b"]);
  });
  it("a source with no pointers yields nothing, never every source", () => {
    expect(liveIds(registry(rows), "t", "")).toEqual([]);
    expect(liveIds(registry(rows), "t", "nope")).toEqual([]);
  });
  it("filters across page boundaries", () => {
    const many = Array.from({ length: 2500 }, (_, i) => row(String(i).padStart(5, "0"), i % 2 ? "x" : "y"));
    expect(liveIds(registry(many), "t", "x")).toHaveLength(1250);
  });
});
