import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { put, stack } from "../support/source.js";

const ask = (s: ReturnType<typeof stack>, query: string) => s.ix.search({ query, asker: { principals: ["user:ana"] } });

describe("connector listing into rank", () => {
  it("indexes what the connector lists and a search returns pointers only", async () => {
    const s = stack();
    put(s.root, "plans/roadmap.md", "quarterly roadmap for payments", ["ana"]);
    put(s.root, "plans/budget.md", "quarterly budget review", ["ana"]);
    put(s.root, "misc/lunch.md", "pizza on friday", ["ana"]);
    expect((await s.index()).created).toHaveLength(3);

    const hits = ask(s, "quarterly");
    expect(hits.map((h) => h.id).sort()).toEqual(["docs/plans/budget.md", "docs/plans/roadmap.md"]);
    expect(hits.map((h) => h.path).sort()).toEqual(["plans/budget.md", "plans/roadmap.md"]);
    for (const h of hits) expect(Object.keys(h).sort()).toEqual(["id", "path", "score", "signals"]);
  });

  it("indexes an edited document by its new text on the next pass", async () => {
    const s = stack();
    put(s.root, "a.md", "alpha original", ["ana"]);
    await s.index();
    put(s.root, "a.md", "alpha rewritten with zebra", ["ana"]);
    expect((await s.index()).updated).toEqual(["docs/a.md"]);
    expect(ask(s, "zebra")).toHaveLength(1);
    expect(ask(s, "original")).toHaveLength(0);
  });

  it("removes a deleted document from search", async () => {
    const s = stack();
    put(s.root, "keep.md", "launch checklist", ["ana"]);
    put(s.root, "gone.md", "launch secrets", ["ana"]);
    await s.index();
    rmSync(join(s.root, "gone.md"));
    rmSync(join(s.root, "gone.md.acl.json"));
    expect((await s.index()).deleted).toEqual(["docs/gone.md"]);
    expect(ask(s, "launch").map((h) => h.id)).toEqual(["docs/keep.md"]);
    expect(ask(s, "secrets")).toEqual([]);
  });
});
