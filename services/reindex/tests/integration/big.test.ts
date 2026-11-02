import { join } from "node:path";
import type { Connector } from "@anvesx/connector-kit";
import { describe, expect, it } from "vitest";
import { reindex, type SourceDoc } from "../../src/reindex.js";
import { openRank, tmp } from "../support/source.js";

const N = 10_001;
const docs: SourceDoc[] = Array.from({ length: N }, (_, i) => ({
  id: `d${i}`,
  title: `t${i}`,
  address: `/p/${i}`,
  version: "v1",
  updatedAt: "2026-01-01T00:00:00Z",
  readers: ["u"],
}));
const connector: Connector = { id: "c", list: async () => ({ items: [] }), fetch: async () => ({ text: "hello world", version: "v1" }) };

describe("reindex of a corpus above the rank batch cap", () => {
  it("indexes all of 10,001 documents and remembers each", async () => {
    const index = openRank(join(tmp(), "big.sqlite"));
    const known = new Map<string, string>();
    const run = () => reindex({ docs, connector, token: "t", index, known });
    const diff = await run();
    expect(diff.created).toHaveLength(N);
    expect(known.size).toBe(N);
    expect(index.search({ query: "hello", asker: { principals: ["u"] }, k: 100 })).toHaveLength(100);
    expect((await run()).created).toEqual([]);
  });
});
