import { describe, expect, it } from "vitest";
import { prepare } from "../../src/pipeline/prepare.js";
import { pointer, sha } from "../support/harness.js";

const chunk = async (docId: string, text: string) => (text.trim() === "" ? [] : [{ id: "c0", docId, index: 0, text, start: 0, end: text.length }]);
const two = async (d: string) => [0, 1].map((i) => ({ id: `c${i}`, docId: d, index: i, text: "t", start: 0, end: 1 }));
const hello = () => pointer({ contentHash: sha("hello") });
const base = {
  fetchText: async () => "hello",
  chunk,
  embed: async (t: string[]) => t.map(() => [1, 2, 3]),
};

describe("prepare", () => {
  it("pairs chunks with embeddings", async () => {
    const rows = await prepare(base, hello());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.embedding).toEqual([1, 2, 3]);
    expect(rows[0]?.chunk.docId).toBe("d1");
  });

  it("skips embed for empty text", async () => {
    let called = false;
    const embed = async (t: string[]) => {
      called = true;
      return t.map(() => [1]);
    };
    expect(await prepare({ ...base, fetchText: async () => "", embed }, pointer({ contentHash: sha("") }))).toEqual([]);
    expect(called).toBe(false);
  });

  it.each([
    ["non-array", async () => "x"],
    ["short", async () => []],
    ["empty vector", async () => [[]]],
    ["NaN", async () => [[1, Number.NaN]]],
    ["Infinity", async () => [[Number.POSITIVE_INFINITY]]],
    ["string element", async () => [["1"]]],
    ["non-array row", async () => [5]],
  ])("rejects %s embeddings", async (_n, embed) => {
    await expect(prepare({ ...base, embed: embed as never }, hello())).rejects.toMatchObject({
      code: "EMBED_INVALID",
    });
  });

  it("rejects ragged vectors", async () => {
    const embed = async () => [[1, 2], [1]];
    await expect(prepare({ ...base, chunk: two, embed }, hello())).rejects.toMatchObject({
      code: "EMBED_INVALID",
    });
  });

  it("rejects non-string fetch result", async () => {
    const fetchText = (async () => 5) as never;
    await expect(prepare({ ...base, fetchText }, hello())).rejects.toMatchObject({
      code: "FETCH_FAILED",
    });
  });

  it("keeps the original error as cause", async () => {
    const boom = new Error("boom");
    const fetchText = async () => {
      throw boom;
    };
    const err = await prepare({ ...base, fetchText }, hello()).catch((e) => e);
    expect(err.cause).toBe(boom);
  });
});
