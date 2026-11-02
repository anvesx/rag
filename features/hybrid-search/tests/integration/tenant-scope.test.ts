import type { Acl } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "../../src/index.js";

const acl: Acl = { allowUsers: ["u"], allowGroups: [], version: 1 };
const add = (index: ReturnType<typeof createSearchIndex>, tenantId: string) =>
  index.add({ chunkId: "same-chunk", docId: "readme", tenantId, text: "hello world", embedding: [1, 0], acl });
const only = (tenantId: string) => ({ text: "hello", embedding: [1, 0], limit: 5, acl: { sql: "tenant_id = ?", params: [tenantId] } });

describe("tenant scoping", () => {
  it("lets two tenants index the same chunk id and doc id", () => {
    const index = createSearchIndex(":memory:", 2);
    add(index, "A");
    expect(() => add(index, "B")).not.toThrow();
    expect(index.search(only("A")).map((h) => h.docId)).toEqual(["readme"]);
    expect(index.search(only("B")).map((h) => h.docId)).toEqual(["readme"]);
  });

  it("removes only the given tenant's chunks", () => {
    const index = createSearchIndex(":memory:", 2);
    add(index, "A");
    add(index, "B");
    expect(index.remove("readme", "A")).toBe(1);
    expect(index.search(only("A"))).toEqual([]);
    expect(index.search(only("B"))).toHaveLength(1);
    expect(index.remove("readme", "A")).toBe(0);
  });

  it("still rejects a duplicate chunk id within one tenant", () => {
    const index = createSearchIndex(":memory:", 2);
    add(index, "A");
    expect(() => add(index, "A")).toThrowError(expect.objectContaining({ code: "DUPLICATE" }));
  });
});
