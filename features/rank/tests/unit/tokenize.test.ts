import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { termKeyer } from "../../src/text/keyed.js";
import { queryTerms, tokenize } from "../../src/text/tokenize.js";

describe("tokenize", () => {
  it("lower-cases and splits on punctuation", () => {
    expect(tokenize("Hello, World! v2.0")).toEqual(["hello", "world", "v2", "0"]);
  });
  it("keeps letters of any script and combining marks together", () => {
    expect(tokenize("日本語 Привет हिन्दी")).toEqual(["日本語", "привет", "हिन्दी"]);
  });
  it("normalizes to NFC so composed and decomposed forms match", () => {
    expect(tokenize("école")).toEqual(tokenize("école"));
  });
  it("returns nothing for empty and punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize(' "*-() ')).toEqual([]);
  });
  it("treats FTS5 operators as plain separators", () => {
    expect(tokenize('NEAR(a b) "x" * OR -y')).toEqual(["near", "a", "b", "x", "or", "y"]);
  });
});

describe("termKeyer", () => {
  const key = "k".repeat(32);
  it("maps a token to 32 hex chars, stable for one key", () => {
    expect(termKeyer(key)("alpha")).toMatch(/^[0-9a-f]{32}$/);
    expect(termKeyer(key)("alpha")).toBe(termKeyer(key)("alpha"));
  });
  it("is not the hex of the token, nor a plain hash of it, and differs per key and per token", () => {
    const t = termKeyer(key)("alpha");
    expect(t).not.toBe(Buffer.from("alpha").toString("hex"));
    expect(t).not.toBe(createHash("sha256").update("alpha").digest("hex").slice(0, 32));
    expect(termKeyer("j".repeat(32))("alpha")).not.toBe(t);
    expect(termKeyer(key)("beta")).not.toBe(t);
  });
  it("takes a string or the same bytes", () => {
    expect(termKeyer(new TextEncoder().encode(key))("alpha")).toBe(termKeyer(key)("alpha"));
  });
});

describe("queryTerms", () => {
  it("returns distinct tokens in first-seen order", () => {
    expect(queryTerms("b a b a")).toEqual(["b", "a"]);
  });
  it("keeps at most 32 distinct terms", () => {
    const q = Array.from({ length: 50 }, (_, i) => `w${i}`).join(" ");
    const terms = queryTerms(q);
    expect(terms).toHaveLength(32);
    expect(terms[0]).toBe("w0");
    expect(terms[31]).toBe("w31");
  });
  it("reads only the first 10000 characters", () => {
    expect(queryTerms(`${"a ".repeat(5000)}zzz`)).toEqual(["a"]);
    expect(queryTerms(`${"a".repeat(9999)} zzz`)).toEqual(["a".repeat(9999)]);
    expect(queryTerms(`${"a".repeat(9998)} zzz`)).toEqual(["a".repeat(9998), "z"]);
  });
});
