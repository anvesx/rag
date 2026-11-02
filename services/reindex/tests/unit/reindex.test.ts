import { utimesSync } from "node:fs";
import { join } from "node:path";
import { createFolderConnector } from "@anvesx/connector-kit";
import type { Doc } from "@rag/rank";
import { describe, expect, it } from "vitest";
import { reindex, type SourceDoc } from "../../src/reindex.js";
import { listDocs, put, stack, TOKEN } from "../support/source.js";

const seen = (): { docs: Doc[]; gate: (d: Doc) => Doc } => {
  const docs: Doc[] = [];
  return {
    docs,
    gate: (d) => {
      docs.push(d);
      return d;
    },
  };
};

describe("reindex builds the document it indexes", () => {
  it("carries title, path, body, readers, no links and the source mtime", async () => {
    const s = stack();
    put(s.root, "a/notes.md", "hello body", ["ana"]);
    const when = new Date("2024-05-06T07:08:09Z");
    utimesSync(join(s.root, "a/notes.md"), when, when);
    const rec = seen();
    await s.index({ gate: rec.gate });
    expect(rec.docs).toHaveLength(1);
    const doc = rec.docs[0] as Doc;
    expect(doc.path).toBe("a/notes.md");
    expect(doc.body).toBe("hello body");
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.principals).toEqual(["user:ana"]);
    expect(doc.links).toEqual([]);
    expect(doc.mtimeMs).toBe(when.getTime());
  });

  it("indexes a document that reports no updatedAt, with mtime 0", async () => {
    const s = stack();
    put(s.root, "a.md", "alpha note", ["ana"]);
    const connector = createFolderConnector("docs", s.root);
    const rec = seen();
    const [listed] = await listDocs(connector);
    const { updatedAt: _dropped, ...bare } = listed as SourceDoc;
    await reindex({ docs: [bare], connector, token: TOKEN, index: s.ix, known: s.known, gate: Object.assign(rec.gate, {}) });
    expect(rec.docs.map((d) => d.mtimeMs)).toEqual([0]);
    expect(s.ix.search({ query: "alpha", asker: { principals: ["user:ana"] } })).toHaveLength(1);
  });

  it("hands the caller's token to every fetch", async () => {
    const s = stack();
    put(s.root, "a.md", "one", ["ana"]);
    const real = createFolderConnector("docs", s.root);
    const tokens: string[] = [];
    const fetch: typeof real.fetch = async (a, c) => {
      tokens.push(c.token);
      return real.fetch(a, c);
    };
    await s.index({ connector: { ...real, fetch } });
    expect(tokens).toEqual([TOKEN]);
  });
});
