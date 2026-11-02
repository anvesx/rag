import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";
import { bad, codeOf } from "../../support/errors.js";

describe("index validation", () => {
  const cases: [string, unknown][] = [
    ["empty id", doc("")],
    ["empty path", doc("a", { path: "" })],
    ["long id", doc("x".repeat(1025))],
    ["NUL in id", doc("a\0b")],
    ["lone surrogate in path", doc("a", { path: "\ud800" })],
    ["non-string title", doc("a", { title: bad(1) })],
    ["non-string body", doc("a", { body: bad(null) })],
    ["principals not array", doc("a", { principals: bad("company") })],
    ["non-string principal", doc("a", { principals: bad([1]) })],
    ["NaN mtime", doc("a", { mtimeMs: Number.NaN })],
    ["Infinity mtime", doc("a", { mtimeMs: Number.POSITIVE_INFINITY })],
    ["links not array", doc("a", { links: bad(undefined) })],
    ["non-string link", doc("a", { links: bad([2]) })],
    ["null doc", null],
  ];
  it.each(cases)("rejects %s with BAD_DOC", (_name, d) => {
    expect(codeOf(() => open().index([bad(d)]))).toBe("BAD_DOC");
  });
  it("writes nothing when any doc in the batch is bad", () => {
    const ix = open();
    expect(codeOf(() => ix.index([doc("ok", { title: "alpha" }), doc("")]))).toBe("BAD_DOC");
    expect(ix.search({ query: "alpha", asker: { principals: ["company"] } })).toEqual([]);
  });
  it("accepts the length limit exactly", () => {
    expect(open().index([doc("x".repeat(1024), { path: "p".repeat(1024) })])).toEqual({ indexed: 1 });
    expect(codeOf(() => open().index([doc("x".repeat(1025), { path: "/p" })]))).toBe("BAD_DOC");
    expect(codeOf(() => open().index([doc("x", { path: "p".repeat(1025) })]))).toBe("BAD_DOC");
  });
  it("rejects a non-array batch", () => {
    expect(codeOf(() => open().index(bad("nope")))).toBe("BAD_DOC");
  });
  it("throws CLOSED after close, for every method", () => {
    const c = open();
    c.close();
    expect(codeOf(() => c.index([]))).toBe("CLOSED");
    expect(codeOf(() => c.remove([]))).toBe("CLOSED");
    expect(codeOf(() => c.search({ query: "a", asker: { principals: ["x"] } }))).toBe("CLOSED");
    expect(() => c.close()).not.toThrow();
  });
});
