import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { put, stack } from "../support/source.js";

const ask = (s: ReturnType<typeof stack>, q: string) =>
  s.ix
    .search({ query: q, asker: { principals: ["user:ana"] } })
    .map((h) => h.id)
    .sort();
/** Makes the next `index` call on the real rank index throw, as a full disk would. */
const failOnce = (s: ReturnType<typeof stack>) => {
  const real = s.ix.index.bind(s.ix);
  s.ix.index = () => {
    s.ix.index = real;
    throw new Error("disk full");
  };
};

describe("reindex commits before it remembers", () => {
  it("retries every document of a pass whose index step threw", async () => {
    const s = stack();
    put(s.root, "a.md", "alpha note", ["ana"]);
    put(s.root, "b.md", "alpha memo", ["ana"]);
    failOnce(s);
    await expect(s.index()).rejects.toThrow("disk full");
    expect(s.known.size).toBe(0);

    const diff = await s.index();
    expect(diff.created).toEqual(["docs/a.md", "docs/b.md"]);
    expect(ask(s, "alpha")).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("keeps a deleted document known when the index step threw, and removes it on the retry", async () => {
    const s = stack();
    put(s.root, "a.md", "alpha note", ["ana"]);
    put(s.root, "b.md", "alpha memo", ["ana"]);
    await s.index();
    rmSync(join(s.root, "a.md"));
    rmSync(join(s.root, "a.md.acl.json"));
    put(s.root, "c.md", "alpha draft", ["ana"]);
    failOnce(s);
    await expect(s.index()).rejects.toThrow("disk full");
    expect(s.known.has("docs/a.md")).toBe(true);

    const diff = await s.index();
    expect(diff.deleted).toEqual(["docs/a.md"]);
    expect(ask(s, "alpha")).toEqual(["docs/b.md", "docs/c.md"]);
  });
});
