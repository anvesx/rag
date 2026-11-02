import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";

const asker = { principals: ["company"] };
const ids = (hits: { id: string }[]) => hits.map((h) => h.id);
const flat = (id: string, over: Parameters<typeof doc>[1] = {}) => doc(id, { title: "x", path: `/${id}`, body: "x", ...over });

describe("search", () => {
  it("returns pointers only: id, path, score, signals", () => {
    const ix = open();
    ix.index([doc("a", { title: "secretword", body: "bodytext secretword", path: "/p/a" })]);
    const [hit] = ix.search({ query: "secretword", asker });
    expect(Object.keys(hit ?? {}).sort()).toEqual(["id", "path", "score", "signals"]);
    expect(Object.keys(hit?.signals ?? {}).sort()).toEqual(["links", "recency", "text"]);
    expect(hit).toMatchObject({ id: "a", path: "/p/a" });
    expect(JSON.stringify(hit)).not.toContain("bodytext");
  });
  it("weights title above path above body", () => {
    const ix = open();
    ix.index([flat("c", { body: "deploy" }), flat("b", { path: "/deploy" }), flat("a", { title: "deploy" })]);
    const hits = ix.search({ query: "deploy", asker });
    expect(ids(hits)).toEqual(["a", "b", "c"]);
    expect(hits[0]?.signals.text).toBeGreaterThan(hits[1]?.signals.text ?? 9);
  });
  it("uses OR semantics across terms and prefers docs matching more", () => {
    const ix = open();
    ix.index([flat("one", { title: "alpha" }), flat("both", { title: "alpha beta" }), flat("none", { title: "gamma" })]);
    expect(ids(ix.search({ query: "alpha beta", asker }))).toEqual(["both", "one"]);
  });
  it("breaks ties by id ascending and sorts scores descending", () => {
    const ix = open();
    ix.index([flat("b", { title: "q" }), flat("a", { title: "q" }), flat("c", { title: "q q" })]);
    const hits = ix.search({ query: "q", asker });
    expect(ids(hits)).toEqual(["c", "a", "b"]);
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 9);
    expect(hits[1]?.score).toBe(hits[2]?.score);
  });
  it("honours k, with a default of 10", () => {
    const ix = open();
    ix.index(Array.from({ length: 15 }, (_, i) => flat(`d${String(i).padStart(2, "0")}`, { title: "t" })));
    expect(ix.search({ query: "t", asker })).toHaveLength(10);
    expect(ix.search({ query: "t", asker, k: 3 })).toHaveLength(3);
    expect(ix.search({ query: "t", asker, k: 100 })).toHaveLength(15);
  });
  it("matches across scripts, case and normalization forms", () => {
    const ix = open();
    ix.index([flat("ru", { title: "Привет мир" }), flat("jp", { title: "日本語" }), flat("fr", { title: "École" })]);
    expect(ids(ix.search({ query: "ПРИВЕТ", asker }))).toEqual(["ru"]);
    expect(ids(ix.search({ query: "日本語", asker }))).toEqual(["jp"]);
    expect(ids(ix.search({ query: "école", asker }))).toEqual(["fr"]);
  });
  it("returns [] for empty index, empty query, punctuation and unknown terms", () => {
    const ix = open();
    expect(ix.search({ query: "alpha", asker })).toEqual([]);
    ix.index([flat("a", { title: "alpha" })]);
    for (const query of ["", "   ", '"*()', "zzzz"]) expect(ix.search({ query, asker })).toEqual([]);
  });
  it("does not score a doc that only has priors", () => {
    const ix = open();
    ix.index([flat("a", { title: "alpha" }), flat("l", { links: ["a"] })]);
    expect(ids(ix.search({ query: "alpha", asker }))).toEqual(["a"]);
  });
});
