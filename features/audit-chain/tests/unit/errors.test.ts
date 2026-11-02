import { describe, expect, it } from "vitest";
import { AuditError } from "../../src/errors.js";

describe("AuditError", () => {
  it("carries code, name, message and cause", () => {
    const cause = new Error("root");
    const e = new AuditError("STORAGE", "boom", { cause });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AuditError");
    expect(e.code).toBe("STORAGE");
    expect(e.message).toBe("boom");
    expect(e.cause).toBe(cause);
  });
});
