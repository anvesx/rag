import { rmSync } from "node:fs";
import { join } from "node:path";
import type { Doc } from "@rag/rank";
import { describe, expect, it } from "vitest";
import { put, stack } from "../support/source.js";

describe("reindex lifecycle", () => {
  it("forgets a deleted document and returns the diff", async () => {
    const s = stack();
    put(s.root, "x.md", "one", ["ana"]);
    expect((await s.index()).created).toHaveLength(1);
    expect(s.known.size).toBe(1);
    rmSync(join(s.root, "x.md"));
    rmSync(join(s.root, "x.md.acl.json"));
    expect((await s.index()).deleted).toHaveLength(1);
    expect(s.known.size).toBe(0);
  });

  it("reindexes an unedited document when the gate's tag changes", async () => {
    const s = stack();
    put(s.root, "a.md", "one", ["ana"]);
    let zone = "company";
    const gate = Object.assign((d: Doc) => d, { tag: () => zone });
    await s.index({ gate });
    expect((await s.index({ gate })).updated).toEqual([]);
    zone = "personal";
    expect((await s.index({ gate })).updated).toEqual(["docs/a.md"]);
  });
});
