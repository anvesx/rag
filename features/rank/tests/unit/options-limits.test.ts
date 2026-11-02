import { describe, expect, it } from "vitest";
import { RankIndex } from "../../src/index.js";
import { doc, KEY, open } from "../support/docs.js";
import { bad, codeOf } from "../support/errors.js";

const code = (opts: unknown) => codeOf(() => RankIndex.open(":memory:", bad(opts)).close());
const asker = { principals: ["company"] };

describe("open options", () => {
  it.each([
    ["no options", undefined],
    ["no key", {}],
    ["numeric key", { key: 1234567890123456 }],
    ["short string key", { key: "short" }],
    ["short byte key", { key: new Uint8Array(15) }],
    ["empty key", { key: "" }],
  ])("rejects %s with BAD_OPTIONS", (_n, opts) => {
    expect(code(opts)).toBe("BAD_OPTIONS");
  });
  it("accepts a 16 byte key as a string or as bytes", () => {
    expect(code({ key: "k".repeat(16) })).toBe("none");
    expect(code({ key: new Uint8Array(16).fill(7) })).toBe("none");
  });
  it.each([
    ["NaN", { title: Number.NaN, path: 1, body: 1 }],
    ["negative", { title: 3, path: -1, body: 1 }],
    ["Infinity", { title: 3, path: 2, body: Number.POSITIVE_INFINITY }],
    ["string", { title: "3", path: 2, body: 1 }],
    ["missing field", { title: 3, path: 2 }],
    ["not an object", 7],
  ])("rejects %s weights with BAD_OPTIONS", (_n, weights) => {
    expect(code({ key: KEY, weights })).toBe("BAD_OPTIONS");
  });
  it("accepts zero weights and scores a finite number", () => {
    const ix = RankIndex.open(":memory:", { key: KEY, weights: { title: 0, path: 0, body: 1 } });
    ix.index([doc("a", { title: "alpha", body: "alpha" })]);
    expect(ix.search({ query: "alpha", asker })[0]?.score).toBeGreaterThan(0);
    ix.close();
  });
});

describe("size limits", () => {
  const big = (n: number) => "a".repeat(n);
  const list = (n: number) => Array.from({ length: n }, (_, i) => `x${i}`);
  it("caps title and body at 2,000,000 characters", () => {
    expect(open().index([doc("a", { title: big(2_000_000), body: big(2_000_000) })])).toEqual({ indexed: 1 });
    expect(codeOf(() => open().index([doc("a", { title: big(2_000_001) })]))).toBe("BAD_DOC");
    expect(codeOf(() => open().index([doc("a", { body: big(2_000_001) })]))).toBe("BAD_DOC");
  });
  it("caps principals and links at 1000 per doc", () => {
    expect(open().index([doc("a", { principals: list(1000), links: list(1000) })])).toEqual({ indexed: 1 });
    expect(codeOf(() => open().index([doc("a", { principals: list(1001) })]))).toBe("BAD_DOC");
    expect(codeOf(() => open().index([doc("a", { links: list(1001) })]))).toBe("BAD_DOC");
  });
  it("caps a batch at 10,000 docs and a removal at 10,000 ids", () => {
    const ids = list(10_001);
    expect(open().index(ids.slice(0, 10_000).map((id) => doc(id)))).toEqual({ indexed: 10_000 });
    expect(codeOf(() => open().index(ids.map((id) => doc(id))))).toBe("BAD_DOC");
    expect(open().remove(ids.slice(0, 10_000))).toEqual({ removed: 0 });
    expect(codeOf(() => open().remove(ids))).toBe("BAD_DOC");
  }, 60_000);
});

describe("remove validation", () => {
  it("rejects a string instead of removing its characters", () => {
    const ix = open();
    ix.index([doc("a"), doc("b"), doc("c"), doc("abc")]);
    expect(codeOf(() => ix.remove(bad("abc")))).toBe("BAD_DOC");
    expect(ix.remove(["a", "b", "c", "abc"])).toEqual({ removed: 4 });
  });
  it.each([[[1]], [[null]], [[{}]], [[""]], [["a\0b"]], [["\ud800"]], [["x".repeat(1025)]], [undefined], [null]])("rejects %j with BAD_DOC", (ids) => {
    expect(codeOf(() => open().remove(bad(ids)))).toBe("BAD_DOC");
  });
  it("removes nothing when any id in the list is bad", () => {
    const ix = open();
    ix.index([doc("a", { title: "alpha" })]);
    expect(codeOf(() => ix.remove(["a", bad(5)]))).toBe("BAD_DOC");
    expect(ix.search({ query: "alpha", asker })).toHaveLength(1);
  });
});
