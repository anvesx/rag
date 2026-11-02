import { describe, expect, it } from "vitest";
import { ChunkError } from "../../src/errors.js";

describe("ChunkError", () => {
  it("is an Error that carries a stable code", () => {
    const err = new ChunkError("BAD_OPTIONS", "size must be at least 1");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChunkError);
    expect(err.code).toBe("BAD_OPTIONS");
    expect(err.message).toBe("size must be at least 1");
    expect(err.name).toBe("ChunkError");
  });
  it("keeps the OFFSET_LOST code distinct from BAD_OPTIONS", () => {
    expect(new ChunkError("OFFSET_LOST", "x").code).toBe("OFFSET_LOST");
    expect(new ChunkError("OFFSET_LOST", "x").code).not.toBe("BAD_OPTIONS");
  });
});
