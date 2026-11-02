import { describe, expect, it } from "vitest";
import { SearchInputSchema } from "../../src/schema.js";

describe("SearchInputSchema", () => {
  it.each(["", "x".repeat(2001)])("rejects query length %s", (query) => {
    expect(SearchInputSchema.safeParse({ query }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 51])("rejects limit %s", (limit) => {
    expect(SearchInputSchema.safeParse({ query: "roadmap", limit }).success).toBe(false);
  });

  it("accepts unicode boundaries and defaults limit to ten", () => {
    const query = "界".repeat(2000);
    expect(SearchInputSchema.parse({ query })).toEqual({ query, limit: 10 });
    expect(SearchInputSchema.parse({ query: "x", limit: 50 }).limit).toBe(50);
  });

  it.each([null, [], "query", { query: null }, { query: "x", extra: true }])("rejects malformed input", (input) => {
    expect(SearchInputSchema.safeParse(input).success).toBe(false);
  });
});
