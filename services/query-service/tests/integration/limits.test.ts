import { describe, expect, it } from "vitest";
import { QueryError } from "../../src/index.js";
import { alice, rig } from "../harness.js";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof QueryError ? e.code : `other:${String(e)}`;
  }
  return "none";
};

describe("limit bounds", () => {
  it("honours limits 1 and 100, defaults to 10", () => {
    const { seed, ids } = rig();
    for (let i = 0; i < 12; i++) seed({ id: `d${String(i).padStart(2, "0")}`, users: ["alice"] });
    expect(ids(alice, "needle", 1)).toHaveLength(1);
    expect(ids(alice, "needle", 100)).toHaveLength(12);
    expect(ids(alice)).toHaveLength(10);
  });

  it.each([0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects limit %s", (limit) => {
    const { ids } = rig();
    expect(code(() => ids(alice, "needle", limit))).toBe("LIMIT");
  });

  it("fills the limit when top-ranked hits are hidden", () => {
    const { seed, registry, ids } = rig();
    for (let i = 0; i < 5; i++) seed({ id: `d${i}`, users: ["alice"] });
    for (let i = 0; i < 4; i++) registry.tombstone("t1", `d${i}`, "2026-11-02T00:00:00Z");
    expect(ids(alice, "needle", 1)).toHaveLength(1);
  });
});

describe("input errors", () => {
  it.each(["", "   ", "\n\t"])("rejects empty query %j", (query) => {
    const { ids } = rig();
    expect(code(() => ids(alice, query))).toBe("EMPTY_QUERY");
  });

  it("rejects a malformed principal and a non-string query", () => {
    const { service } = rig();
    const bad = (principal: unknown, query: unknown = "x") => code(() => service.search({ query, principal, embedding: [1, 0] } as never));
    expect(bad({ id: "", tenantId: "t1", groups: [] })).toBe("PRINCIPAL");
    expect(bad(undefined)).toBe("PRINCIPAL");
    expect(bad(alice, 5)).toBe("EMPTY_QUERY");
  });

  it("maps a wrong-dimension embedding to EMBEDDING", () => {
    const { service } = rig();
    expect(code(() => service.search({ query: "x", principal: alice, embedding: [1] }))).toBe("EMBEDDING");
  });
});
