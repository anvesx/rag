import { describe, expect, it } from "vitest";
import { createCursorStore } from "../../../src/store.js";
import { thrownBy } from "../support.js";

const fresh = () => createCursorStore(":memory:", () => 0);

describe("cursor limits and input rules", () => {
  it("accepts a value of exactly 4096 characters", () => {
    const s = fresh();
    s.setCursor("t1", "drive", "x".repeat(4096));
    expect(s.getCursor("t1", "drive")?.length).toBe(4096);
  });

  it("counts characters by code point, so 4096 emoji are accepted", () => {
    expect(() => fresh().setCursor("t1", "drive", "😀".repeat(4096))).not.toThrow();
  });

  it("rejects a value of 4097 characters with a typed size error", () => {
    const s = fresh();
    const err = thrownBy(() => s.setCursor("t1", "drive", "x".repeat(4097)));
    expect(err.code).toBe("CURSOR_TOO_LARGE");
    expect(err.message).toContain("4096");
    expect(thrownBy(() => s.setCursor("t1", "drive", "😀".repeat(4097))).code).toBe("CURSOR_TOO_LARGE");
    expect(s.getCursor("t1", "drive")).toBeUndefined();
  });

  it.each([[""], [null], [42], [undefined]])("rejects a bad tenant id %j", (bad) => {
    const set = thrownBy(() => fresh().setCursor(bad as never, "drive", "x"));
    expect(set.code).toBe("INVALID_INPUT");
    expect(set.message).toContain("tenantId");
    expect(thrownBy(() => fresh().getCursor(bad as never, "drive")).message).toContain("tenantId");
  });

  it.each([[""], [null], [{}]])("rejects a bad source %j", (bad) => {
    expect(thrownBy(() => fresh().setCursor("t1", bad as never, "x")).message).toContain("source");
    expect(thrownBy(() => fresh().getCursor("t1", bad as never)).message).toContain("source");
  });

  it.each([[null], [7], [{}]])("rejects a non-string cursor %j", (bad) => {
    const err = thrownBy(() => fresh().setCursor("t1", "drive", bad as never));
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toContain("cursor must be a string");
  });
});
