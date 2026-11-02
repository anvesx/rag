import { describe, expect, it } from "vitest";
import type { Doc, Hit, SearchRequest } from "../../src/index.js";
import { doc, open } from "../support/docs.js";
import { oracle } from "../support/oracle.js";

type Impl = { index(d: Doc[]): unknown; search(r: SearchRequest): Hit[] };

/** Adversarial guard: the checks below must pass the real index and fail every plausible stub. */
const CORPUS = [
  doc("a", { title: "alpha release", body: "alpha notes", principals: ["company"], links: ["b"] }),
  doc("b", { title: "beta", body: "alpha beta beta", principals: ["company"] }),
  doc("c", { title: "alpha alpha alpha", body: "secret", principals: ["u:ana"] }),
  doc("d", { title: "gamma", body: "delta alpha", principals: ["u:bo"] }),
];
const ASKERS = [["company"], ["u:ana"], ["company", "u:bo"]];
const QUERIES = ["alpha", "beta", "alpha beta", "gamma delta", "zzz"];

const failures = (ix: Impl): string[] => {
  const out: string[] = [];
  ix.index(CORPUS);
  for (const principals of ASKERS) {
    for (const query of QUERIES) {
      const got = ix.search({ query, asker: { principals }, k: 10 });
      const want = oracle(CORPUS, principals, query, 10);
      if (JSON.stringify(got.map((h) => h.id)) !== JSON.stringify(want.map((h) => h.id))) out.push(`order ${principals} ${query}`);
      if (got.some((h) => "body" in h || "title" in h)) out.push("returns text");
    }
  }
  return out;
};

const real = (): Impl => open();
const empty = (): Impl => ({ index: () => 0, search: () => [] });
const noAcl = (): Impl => {
  const ix = open();
  return { index: (d) => ix.index(d.map((x) => ({ ...x, principals: ["*"] }))), search: (r) => ix.search({ ...r, asker: { principals: ["*"] } }) };
};
const unranked = (): Impl => {
  let docs: Doc[] = [];
  return {
    index: (d) => {
      docs = d;
    },
    search: (r) =>
      docs
        .filter((d) => d.principals.some((p) => r.asker.principals.includes(p)))
        .filter((d) => r.query.split(" ").some((w) => `${d.title} ${d.body}`.includes(w)))
        .sort((x, y) => (x.id < y.id ? -1 : 1))
        .map((d) => ({ id: d.id, path: d.path, score: 1, signals: { text: 1, recency: 0, links: 0 } })),
  };
};
const echo = (): Impl => ({
  index: () => 0,
  search: () => CORPUS.slice(0, 2).map((d) => ({ id: d.id, path: d.path, score: 1, signals: { text: 1, recency: 0, links: 0 } })),
});

describe("no-fake guard", () => {
  it("passes the real index", () => {
    expect(failures(real())).toEqual([]);
  });
  it.each([
    ["empty", empty],
    ["ignores ACL", noAcl],
    ["no ranking, id order", unranked],
    ["constant answer", echo],
  ])("rejects a stub that is %s", (_n, make) => {
    expect(failures(make()).length).toBeGreaterThan(0);
  });
});
