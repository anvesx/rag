import { describe, expect, it } from "vitest";
import { createRegistry, RegistryError } from "../../src/index.js";
import { ptr } from "../fixtures.js";

const code = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof RegistryError ? e.code : "other";
  }
  return "no-throw";
};

describe("tenant isolation", () => {
  it("same id in two tenants are separate rows", () => {
    const r = createRegistry(":memory:");
    expect(r.upsert(ptr({ tenantId: "a", title: "A" })).change).toBe("created");
    expect(r.upsert(ptr({ tenantId: "b", title: "B" })).change).toBe("created");
    expect(r.get("a", "doc-1")?.title).toBe("A");
    expect(r.get("b", "doc-1")?.title).toBe("B");
    expect(r.list({ tenantId: "a" })).toHaveLength(1);
    expect(r.tombstone("a", "doc-1", "2026-11-02T00:00:00Z")).toBe(true);
    expect(r.get("b", "doc-1")).toBeDefined();
    expect(r.get("c", "doc-1")).toBeUndefined();
    expect(r.list({ tenantId: "c" })).toEqual([]);
  });
  it.each(["", undefined, null, 5])("empty tenant %j throws TENANT_REQUIRED everywhere", (t) => {
    const r = createRegistry(":memory:");
    expect(code(() => r.get(t as never, "x"))).toBe("TENANT_REQUIRED");
    expect(code(() => r.list({ tenantId: t as never }))).toBe("TENANT_REQUIRED");
    expect(code(() => r.tombstone(t as never, "x", "2026-11-02T00:00:00Z"))).toBe("TENANT_REQUIRED");
    expect(code(() => r.upsert({ ...ptr(), tenantId: t } as never))).toBe("TENANT_REQUIRED");
  });
  it("list without a query object is TENANT_REQUIRED", () => {
    expect(code(() => createRegistry(":memory:").list(undefined as never))).toBe("TENANT_REQUIRED");
  });
});

describe("tombstone", () => {
  const at = "2026-11-02T00:00:00Z";
  it("hides row, returns true once, false after and for missing", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr());
    expect(r.tombstone("t1", "doc-1", at)).toBe(true);
    expect(r.get("t1", "doc-1")).toBeUndefined();
    expect(r.list({ tenantId: "t1" })).toEqual([]);
    expect(r.tombstone("t1", "doc-1", at)).toBe(false);
    expect(r.tombstone("t1", "missing", at)).toBe(false);
  });
  it("re-upsert revives, even with identical hash/version/acl", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr());
    r.tombstone("t1", "doc-1", at);
    expect(r.upsert(ptr()).change).toBe("updated");
    expect(r.get("t1", "doc-1")?.deletedAt).toBeNull();
  });
  it("rejects a bad timestamp with INVALID", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr());
    expect(code(() => r.tombstone("t1", "doc-1", "nope"))).toBe("INVALID");
    expect(r.get("t1", "doc-1")).toBeDefined();
  });
  it("upserting a pointer that carries deletedAt stores it tombstoned", () => {
    const r = createRegistry(":memory:");
    r.upsert(ptr({ deletedAt: at }));
    expect(r.get("t1", "doc-1")).toBeUndefined();
  });
});
