import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLogger } from "../../src/runtime/logger.js";

afterEach(() => vi.restoreAllMocks());

describe("defaultLogger", () => {
  it("writes one JSON line per call to stderr", () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    defaultLogger.error("search failed", { cause: "boom" });
    defaultLogger.warn("w");
    defaultLogger.info("i");
    const lines = write.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ level: "error", msg: "search failed", cause: "boom" });
    expect(lines[1]).toMatchObject({ level: "warn", msg: "w" });
    expect(lines[2]).toMatchObject({ level: "info", msg: "i" });
    expect(typeof lines[0]?.ts).toBe("string");
    expect(String(write.mock.calls[0]?.[0]).endsWith("\n")).toBe(true);
  });
});
