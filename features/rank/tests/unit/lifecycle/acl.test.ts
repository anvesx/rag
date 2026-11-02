import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";

const find = (ix: ReturnType<typeof open>, principals: string[], query = "t") => ix.search({ query, asker: { principals } }).map((h) => h.id);
const corpus = () => {
  const ix = open();
  ix.index([
    doc("mine", { title: "t", principals: ["u:ana"] }),
    doc("theirs", { title: "t", principals: ["u:bo"] }),
    doc("team", { title: "t", principals: ["t:eng", "t:ops"] }),
    doc("all", { title: "t", principals: ["company"] }),
  ]);
  return ix;
};

describe("acl", () => {
  it("shows a doc when any asker principal matches any doc principal", () => {
    const ix = corpus();
    expect(find(ix, ["u:ana"])).toEqual(["mine"]);
    expect(find(ix, ["u:ana", "t:ops"])).toEqual(["mine", "team"]);
    expect(find(ix, ["u:ana", "t:eng", "company"])).toEqual(["all", "mine", "team"]);
  });
  it("matches principals exactly, with case and prefixes significant", () => {
    const ix = corpus();
    expect(find(ix, ["U:ANA"])).toEqual([]);
    expect(find(ix, ["u:an"])).toEqual([]);
    expect(find(ix, ["u:ana "])).toEqual([]);
    expect(find(ix, ["u:%"])).toEqual([]);
  });
  it("treats SQL and JSON metacharacters in principals as data", () => {
    const ix = corpus();
    expect(find(ix, ['"],"u:ana'])).toEqual([]);
    expect(find(ix, ["' OR 1=1 --"])).toEqual([]);
    expect(find(ix, ["u:ana", "u:ana", "u:ana"])).toEqual(["mine"]);
  });
  it("stores a doc once per principal without duplicating hits", () => {
    const ix = open();
    ix.index([doc("a", { title: "t", principals: ["x", "x", "y"] })]);
    expect(find(ix, ["x", "y"])).toEqual(["a"]);
  });
  it("shows an asker with a company principal only company docs", () => {
    expect(find(corpus(), ["company"])).toEqual(["all"]);
  });
  it("gives a hit the same score whoever sees it, when the visible corpus is the same", () => {
    const a = open();
    const b = open();
    a.index([doc("x", { title: "t", principals: ["p"] })]);
    b.index([doc("x", { title: "t", principals: ["p"] }), doc("hidden", { title: "t t t", body: "t t t", principals: ["q"] })]);
    const ask = { query: "t", asker: { principals: ["p"] } };
    expect(b.search(ask)).toEqual(a.search(ask));
  });
});
