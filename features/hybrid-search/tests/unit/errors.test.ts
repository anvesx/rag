import { describe, expect, it } from "vitest";
import { SearchError } from "../../src/index.js";

describe("SearchError", () => {
  it("carries code, name, message and optional cause", () => {
    const cause = new Error("boom");
    const error = new SearchError("DB", cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SearchError");
    expect(error.code).toBe("DB");
    expect(error.message).toBe("DB");
    expect(error.cause).toBe(cause);
  });

  it("has no cause when none is given", () => {
    expect("cause" in new SearchError("DIM")).toBe(false);
  });
});
