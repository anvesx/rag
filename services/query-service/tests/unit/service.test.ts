import type { Pointer } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createQueryService, QueryError } from "../../src/index.js";
import { alice } from "../harness.js";

const ptr = (over: Partial<Pointer> = {}): Pointer => ({
  id: "d1",
  tenantId: "t1",
  source: "s",
  address: "a",
  title: "",
  version: "v",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: ["alice"], allowGroups: [], version: 1 },
  updatedAt: "2026-11-01T00:00:00Z",
  deletedAt: null,
  ...over,
});
const hit = (docId: string) => ({ chunkId: `${docId}-c`, docId, score: 1 });
const run = (hits: string[], pointers: Record<string, Pointer | undefined>, limit?: number) => {
  const calls: unknown[] = [];
  const service = createQueryService({
    index: {
      search: (q) => {
        calls.push(q);
        return hits.map(hit);
      },
    },
    registry: { get: (t, id) => pointers[`${t}/${id}`] },
  });
  const out = service.search({ query: " q ", principal: alice, embedding: [1], ...(limit === undefined ? {} : { limit }) });
  return { out, calls };
};

describe("createQueryService", () => {
  it("drops pointers whose own tenant differs from the principal", () => {
    expect(run(["d1"], { "t1/d1": ptr({ tenantId: "t2" }) }).out).toEqual([]);
  });

  it("drops tombstoned pointers even if the registry returns one", () => {
    expect(run(["d1"], { "t1/d1": ptr({ deletedAt: "2026-11-02T00:00:00Z" }) }).out).toEqual([]);
  });

  it("preserves rank order and dedupes by document", () => {
    const { out } = run(["b", "a", "b"], { "t1/a": ptr({ id: "a" }), "t1/b": ptr({ id: "b" }) });
    expect(out.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sends the trimmed query, the principal's ACL clause and the max fetch size to the index", () => {
    const { calls } = run([], {});
    expect(calls).toEqual([
      { text: "q", embedding: [1], limit: 100, offset: 0, acl: expect.objectContaining({ params: expect.arrayContaining(["t1", "alice"]) }) },
    ]);
  });

  it("slices to the limit", () => {
    const { out } = run(["a", "b"], { "t1/a": ptr({ id: "a" }), "t1/b": ptr({ id: "b" }) }, 1);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  it("wraps backend failures as BACKEND with the cause", () => {
    const cause = new Error("boom");
    const index = {
      search: () => {
        throw cause;
      },
    };
    const service = createQueryService({ index, registry: { get: () => undefined } });
    try {
      service.search({ query: "q", principal: alice, embedding: [1] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(QueryError);
      expect((e as QueryError).code).toBe("BACKEND");
      expect((e as QueryError).cause).toBe(cause);
    }
  });
});
