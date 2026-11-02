import { describe, expect, it } from "vitest";
import { escapeFts } from "../../src/escape.js";

describe("escapeFts edges", () => {
  it("handles empty input and collapses whitespace", () => {
    expect(escapeFts("")).toBe("");
    expect(escapeFts("  a \t b  ")).toBe('"a" "b"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeFts('"')).toBe('""""');
  });

  it("escapes a huge input in linear time", () => {
    const started = performance.now();
    const out = escapeFts("w ".repeat(500_000));
    expect(out.length).toBe(500_000 * 4 - 1);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});
