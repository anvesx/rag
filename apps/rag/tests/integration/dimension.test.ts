import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { IndexDimensionError } from "../../src/index.js";
import { start } from "../harness.js";

const dir = mkdtempSync(join(tmpdir(), "rag-dim-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const alice = { id: "alice", tenantId: "t1", groups: [] };
const embedder = (dimension: number) => ({
  dimension,
  embed: async (texts: string[]) => texts.map(() => Array.from({ length: dimension }, (_, i) => (i === 0 ? 1 : 0))),
  embedQuery: async () => Array.from({ length: dimension }, (_, i) => (i === 0 ? 1 : 0)),
});

describe("an existing index with a different vector size", () => {
  it("fails loudly with a typed error and leaves the index untouched", async () => {
    const data = join(dir, "mismatch");
    const first = await start({ dataDir: data, cursors: undefined, ...embedder(3) });
    await first.app.ingest("t1");
    await first.app.close();

    const error = await start({ dataDir: data, cursors: undefined, ...embedder(384) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IndexDimensionError);
    expect(error).toMatchObject({ code: "INDEX_DIMENSION", found: 3, expected: 384 });
    expect((error as Error).message).toContain("fresh RAG_DATA_DIR");

    const again = await start({ dataDir: data, cursors: undefined, ...embedder(3) });
    const found = await again.app.search({ query: "needle", principal: alice });
    expect(found.map((p) => p.address).sort()).toEqual(["a", "b"]);
    await again.app.close();
  });

  it("opens a fresh directory at 384 and reopens it at 384", async () => {
    const data = join(dir, "fresh");
    const first = await start({ dataDir: data, cursors: undefined, ...embedder(384) });
    await first.app.close();
    const second = await start({ dataDir: data, cursors: undefined, ...embedder(384) });
    await second.app.close();
  });
});
