import { describe, expect, it } from "vitest";
import { escapeFts } from "../../src/escape.js";

describe("escapeFts", () => {
  it("quotes every token so FTS operators stay literal", () => {
    expect(escapeFts('alpha" * NEAR beta')).toBe('"alpha""" "*" "NEAR" "beta"');
  });

  it("returns an empty expression for whitespace", () => {
    expect(escapeFts("  \t\n ")).toBe("");
  });
});
