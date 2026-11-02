import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");

describe("ingest then search", () => {
  it("returns the visible docs from real SQLite files in a temp dir", async () => {
    const dir = tmp.make();
    const source = createSource([doc("a", ["alice"], "needle alpha"), doc("b", ["alice"], "needle beta"), doc("c", ["alice"], "unrelated haystack")]);
    const stack = openStack(dir, { t1: source });
    expect(await stack.ingest("t1")).toMatchObject({ emitted: 3, indexed: 3, failed: 0, failures: [], quarantined: [] });
    // The constant embedding makes the vector side match every doc, so rank decides: keyword matches come first.
    expect(addresses(await stack.search(alice, "needle", 2))).toEqual(["a", "b"]);
    expect(addresses(await stack.search(alice, "haystack", 1))).toEqual(["c"]);
    for (const file of ["registry.db", "search.db", "cursors.db", "audit.db"]) expect(existsSync(join(dir, file))).toBe(true);
    stack.close();
  });

  it("returns pointers, never document text", async () => {
    const stack = openStack(tmp.make(), { t1: createSource([doc("a", ["alice"], "secret body words")]) });
    await stack.ingest("t1");
    const [hit] = await stack.search(alice, "secret");
    expect(hit).toMatchObject({ tenantId: "t1", address: "a", title: "a" });
    expect(JSON.stringify(hit)).not.toContain("body words");
    stack.close();
  });

  it("a second run with no change emits nothing", async () => {
    const stack = openStack(tmp.make(), { t1: createSource([doc("a", ["alice"])]) });
    await stack.ingest("t1");
    expect(await stack.ingest("t1")).toMatchObject({ emitted: 0, indexed: 0, failed: 0 });
    stack.close();
  });
});
