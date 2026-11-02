import { describe, expect, it } from "vitest";
import { doc, open } from "../../support/docs.js";
import { NOW } from "../../support/oracle.js";

const asker = { principals: ["company"] };
const ids = (hits: { id: string }[]) => hits.map((h) => h.id);
const flat = (id: string, over: Parameters<typeof doc>[1] = {}) => doc(id, { title: "x", path: `/${id}`, body: "x", ...over });

describe("signals", () => {
  it("ranks a newer doc above an older one with the same text", () => {
    const ix = open();
    ix.index([flat("a-old", { title: "t", mtimeMs: NOW - 90 * 86_400_000 }), flat("b-new", { title: "t" })]);
    const hits = ix.search({ query: "t", asker });
    expect(ids(hits)).toEqual(["b-new", "a-old"]);
    expect(hits[0]?.signals.recency).toBeCloseTo(1, 12);
    expect(hits[1]?.signals.recency).toBeCloseTo(0.5, 12);
  });
  it("ranks a linked doc above an unlinked one and reports ln(1 + inbound)", () => {
    const ix = open();
    ix.index([flat("a", { title: "alpha" }), flat("z", { title: "alpha" }), flat("l1", { links: ["z"] }), flat("l2", { links: ["z", "z"] })]);
    const hits = ix.search({ query: "alpha", asker });
    expect(ids(hits)).toEqual(["z", "a"]);
    expect(hits[0]?.signals.links).toBeCloseTo(Math.log(3), 12);
    expect(hits[1]?.signals.links).toBe(0);
  });
  it("combines signals as text * (1 + 0.2 recency + 0.1 links)", () => {
    const ix = open();
    ix.index([flat("x", { title: "alpha", mtimeMs: NOW - 45 * 86_400_000 }), flat("l", { links: ["x"] })]);
    const [hit] = ix.search({ query: "alpha", asker });
    const s = hit?.signals ?? { text: 0, recency: 0, links: 0 };
    expect(hit?.score).toBeCloseTo(s.text * (1 + 0.2 * s.recency + 0.1 * s.links), 12);
    expect(s.recency).toBeCloseTo(0.5 ** 0.5, 12);
  });
});
