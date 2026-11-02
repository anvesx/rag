import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";

const asker = { principals: ["company"] };
const find = (ix: ReturnType<typeof open>, query: string, principals = ["company"]) => ix.search({ query, asker: { principals } }).map((h) => h.id);

describe("index lifecycle", () => {
  it("re-index replaces text, so old terms stop matching", () => {
    const ix = open();
    ix.index([doc("a", { title: "oldterm" })]);
    ix.index([doc("a", { title: "newterm" })]);
    expect(find(ix, "oldterm")).toEqual([]);
    expect(find(ix, "newterm")).toEqual(["a"]);
  });
  it("re-index replaces the path pointer", () => {
    const ix = open();
    ix.index([doc("a", { title: "t", path: "/old" })]);
    ix.index([doc("a", { title: "t", path: "/new" })]);
    expect(ix.search({ query: "t", asker }).map((h) => h.path)).toEqual(["/new"]);
  });
  it("re-index revokes access at once", () => {
    const ix = open();
    ix.index([doc("a", { title: "t", principals: ["u:ana"] })]);
    expect(find(ix, "t", ["u:ana"])).toEqual(["a"]);
    ix.index([doc("a", { title: "t", principals: ["u:bo"] })]);
    expect(find(ix, "t", ["u:ana"])).toEqual([]);
    expect(find(ix, "t", ["u:bo"])).toEqual(["a"]);
  });
  it("last duplicate id in one call wins and counts once", () => {
    const ix = open();
    expect(ix.index([doc("a", { title: "first" }), doc("a", { title: "second" })])).toEqual({ indexed: 1 });
    expect(find(ix, "first")).toEqual([]);
    expect(find(ix, "second")).toEqual(["a"]);
  });
  it("re-index drops the old outgoing links", () => {
    const ix = open();
    ix.index([doc("t", { title: "alpha" }), doc("l", { links: ["t"] })]);
    ix.index([doc("l", { links: [] })]);
    expect(ix.search({ query: "alpha", asker })[0]?.signals.links).toBe(0);
  });
  it("remove deletes postings, links and the doc, and ignores unknown ids", () => {
    const ix = open();
    ix.index([doc("t", { title: "alpha" }), doc("l", { title: "alpha", links: ["t"] })]);
    expect(ix.remove(["l", "nope"])).toEqual({ removed: 1 });
    const [hit] = ix.search({ query: "alpha", asker });
    expect(hit).toMatchObject({ id: "t", signals: { links: 0 } });
    expect(ix.remove(["t"])).toEqual({ removed: 1 });
    expect(find(ix, "alpha")).toEqual([]);
  });
  it("a removed id can be indexed again", () => {
    const ix = open();
    ix.index([doc("a", { title: "one" })]);
    ix.remove(["a"]);
    ix.index([doc("a", { title: "two" })]);
    expect(find(ix, "one")).toEqual([]);
    expect(find(ix, "two")).toEqual(["a"]);
  });
  it("keeps links to a doc that is indexed later, and ignores self links", () => {
    const ix = open();
    ix.index([doc("l", { links: ["late", "l"] }), doc("l2", { title: "x", links: ["l"] })]);
    ix.index([doc("late", { title: "alpha" })]);
    expect(ix.search({ query: "alpha", asker })[0]?.signals.links).toBeCloseTo(Math.log(2), 12);
    ix.index([doc("l", { title: "alpha", links: ["l"] })]);
    expect(ix.search({ query: "alpha", asker }).find((h) => h.id === "l")?.signals.links).toBeCloseTo(Math.log(2), 12);
  });
  it("a doc with no principals is visible to nobody", () => {
    const ix = open();
    ix.index([doc("a", { title: "t", principals: [] })]);
    expect(find(ix, "t", ["company", "u:ana", ""].filter(Boolean))).toEqual([]);
  });
  it("indexing an empty list is a no-op", () => {
    expect(open().index([])).toEqual({ indexed: 0 });
  });
});
