import { describe, expect, it } from "vitest";
import { verifyContent } from "../../src/pipeline/content.js";
import { IndexServiceError } from "../../src/types.js";
import { pointer, sha } from "../support/harness.js";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof IndexServiceError ? e.code : "other";
  }
  return "none";
};
const p = (text: string) => pointer({ contentHash: sha(text) });

describe("verifyContent", () => {
  it("returns the text when pointer hash, claimed hash and text agree", () => {
    expect(verifyContent(p("abc"), { text: "abc", contentHash: sha("abc") })).toBe("abc");
  });
  it("accepts empty and unicode text", () => {
    expect(verifyContent(p(""), { text: "", contentHash: sha("") })).toBe("");
    const u = "héllo 日本語 🙂";
    expect(verifyContent(p(u), { text: u, contentHash: sha(u) })).toBe(u);
  });
  it("rejects a claimed hash that differs from the pointer's", () => {
    expect(code(() => verifyContent(p("abc"), { text: "abc", contentHash: sha("abd") }))).toBe("HASH_MISMATCH");
  });
  it("rejects text that does not hash to the agreed hash", () => {
    expect(code(() => verifyContent(p("abc"), { text: "abd", contentHash: sha("abc") }))).toBe("HASH_MISMATCH");
  });
  it("rejects a non-string text or hash as an invalid event", () => {
    expect(code(() => verifyContent(p("a"), { text: 1, contentHash: sha("a") } as never))).toBe("INVALID_EVENT");
    expect(code(() => verifyContent(p("a"), { text: "a", contentHash: 1 } as never))).toBe("INVALID_EVENT");
    expect(code(() => verifyContent(p("a"), null as never))).toBe("INVALID_EVENT");
  });
});
