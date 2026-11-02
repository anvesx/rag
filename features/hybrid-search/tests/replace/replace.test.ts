import { describe, expect, it } from "vitest";
import { type AddChunk, createSearchIndex } from "../../src/index.js";

const acl = { allowUsers: ["u"], allowGroups: [], version: 1 };
const chunk = (chunkId: string, text: string, over: Partial<AddChunk> = {}): AddChunk => ({
  chunkId,
  docId: "d1",
  tenantId: "t",
  text,
  embedding: [1, 0],
  acl,
  ...over,
});

/** `ids` lists all chunks of a tenant: the vector list returns every allowed chunk. */
function build() {
  const index = createSearchIndex(":memory:", 2);
  const ids = (tenant = "t") =>
    index
      .search({ text: "alpha beta x", embedding: [1, 0], limit: 50, acl: { sql: "tenant_id = ?", params: [tenant] } })
      .map((h) => h.chunkId)
      .sort();
  return { index, ids };
}

const rejects = (fn: () => unknown, code: string) => expect(fn).toThrow(expect.objectContaining({ code }));

describe("replace", () => {
  it("swaps a doc's chunks and leaves other docs and tenants alone", () => {
    const { index, ids } = build();
    index.add(chunk("old1", "alpha"));
    index.add(chunk("o2", "alpha", { docId: "d2" }));
    index.add(chunk("t2", "alpha", { tenantId: "u" }));
    index.replace("d1", "t", [chunk("n1", "beta"), chunk("n2", "beta")]);
    expect(ids()).toEqual(["n1", "n2", "o2"]);
    expect(ids("u")).toEqual(["t2"]);
  });

  it("with no chunks it removes the doc, and it works on a new doc", () => {
    const { index, ids } = build();
    index.replace("d1", "t", [chunk("a", "alpha")]);
    expect(ids()).toEqual(["a"]);
    index.replace("d1", "t", []);
    expect(ids()).toEqual([]);
  });

  it("may reuse an old chunk id", () => {
    const { index, ids } = build();
    index.add(chunk("same", "alpha"));
    index.replace("d1", "t", [chunk("same", "beta")]);
    expect(ids()).toEqual(["same"]);
  });

  it.each([
    ["duplicate id mid-list", [chunk("a", "x"), chunk("b", "x"), chunk("a", "x")], "DUPLICATE"],
    ["id owned by another doc", [chunk("a", "x"), chunk("other", "x")], "DUPLICATE"],
    ["bad embedding", [chunk("a", "x"), chunk("b", "x", { embedding: [1] })], "DIM"],
    ["wrong doc", [chunk("a", "x"), chunk("b", "x", { docId: "d9" })], "INPUT"],
    ["wrong tenant", [chunk("a", "x", { tenantId: "u" })], "INPUT"],
    ["non-string text", [chunk("a", 5 as never)], "INPUT"],
  ])("%s fails with %s and leaves the old chunks intact", (_n, rows, code) => {
    const { index, ids } = build();
    index.add(chunk("old1", "alpha"));
    index.add(chunk("old2", "alpha"));
    index.add(chunk("other", "alpha", { docId: "d2" }));
    rejects(() => index.replace("d1", "t", rows), code);
    expect(ids()).toEqual(["old1", "old2", "other"]);
  });

  it("rejects invalid ids and a non-array", () => {
    const { index } = build();
    rejects(() => index.replace("", "t", []), "INPUT");
    rejects(() => index.replace("d1", "", []), "INPUT");
    rejects(() => index.replace("d1", "t", "x" as never), "INPUT");
  });
});
