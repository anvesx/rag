import { createFolderConnector } from "@anvesx/connector-kit";
import { describe, expect, it } from "vitest";
import { reindex } from "../../src/reindex.js";
import { TokenRequiredError } from "../../src/token-error.js";
import { listDocs, put, stack } from "../support/source.js";

const bad: [string, unknown][] = [
  ["undefined", undefined],
  ["null", null],
  ["empty", ""],
  ["whitespace-only", " \t\n "],
  ["a non-string", 42],
];

describe("reindex fails closed without a token", () => {
  it.each(bad)("throws TokenRequiredError and fetches nothing for %s", async (_name, token) => {
    const s = stack();
    put(s.root, "a/notes.md", "hello", ["ana"]);
    const inner = createFolderConnector("docs", s.root);
    let fetches = 0;
    const connector = {
      ...inner,
      list: inner.list.bind(inner),
      fetch: (...a: Parameters<typeof inner.fetch>) => {
        fetches += 1;
        return inner.fetch(...a);
      },
    };
    const deps = { docs: await listDocs(inner), connector, token: token as string, index: s.ix, known: s.known };
    const run = reindex(deps);
    await expect(run).rejects.toBeInstanceOf(TokenRequiredError);
    await expect(run).rejects.toMatchObject({ code: "TOKEN_REQUIRED" });
    expect(fetches).toBe(0);
    expect(s.known.size).toBe(0);
  });

  it("still indexes with a real token", async () => {
    const s = stack();
    put(s.root, "a/notes.md", "hello", ["ana"]);
    expect((await s.index()).created).toHaveLength(1);
  });
});
