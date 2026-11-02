import { describe, expect, it } from "vitest";
import { CursorError } from "../../src/errors.js";

describe("CursorError", () => {
  it("is an Error with a name, a message and a typed code", () => {
    const err = new CursorError("INVALID_INPUT", "bad input");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CursorError);
    expect(err.name).toBe("CursorError");
    expect(err.message).toBe("bad input");
    expect(err.code).toBe("INVALID_INPUT");
  });

  it("carries the size code unchanged", () => {
    expect(new CursorError("CURSOR_TOO_LARGE", "long").code).toBe("CURSOR_TOO_LARGE");
  });
});
