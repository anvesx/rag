import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");

describe("delete at the source", () => {
  it("tombstones the pointer and removes it from search", async () => {
    const source = createSource([doc("a", ["alice"]), doc("b", ["alice"])]);
    const stack = openStack(tmp.make(), { t1: source });
    await stack.ingest("t1");
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["a", "b"]);
    source.remove("a");
    expect(await stack.ingest("t1")).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["b"]);
    expect(stack.registry.list({ tenantId: "t1" }).map((p) => p.address)).toEqual(["b"]);
    // The row is kept as a tombstone: list and get hide it, the file still has it.
    const h = new DatabaseSync(stack.registryPath);
    const rows = h.prepare("SELECT address, deleted_at FROM pointers WHERE deleted_at IS NOT NULL").all();
    h.close();
    expect(rows).toEqual([{ address: "a", deleted_at: expect.any(String) }]);
    stack.close();
  });

  it("deleting everything leaves search empty, and a re-created doc comes back", async () => {
    const source = createSource([doc("a", ["alice"])]);
    const stack = openStack(tmp.make(), { t1: source });
    await stack.ingest("t1");
    source.remove("a");
    await stack.ingest("t1");
    expect(await stack.search(alice, "needle")).toEqual([]);
    source.put(doc("a", ["alice"], "needle", [], { version: "v2" }));
    await stack.ingest("t1");
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["a"]);
    stack.close();
  });

  it("a delete in one tenant does not touch another", async () => {
    const s1 = createSource([doc("a", ["alice"])]);
    const s2 = createSource([doc("a", ["alice"])]);
    const stack = openStack(tmp.make(), { t1: s1, t2: s2 });
    await stack.ingest("t1");
    await stack.ingest("t2");
    s1.remove("a");
    await stack.ingest("t1");
    expect(await stack.search(alice, "needle")).toEqual([]);
    expect(addresses(await stack.search(principal("alice", "t2"), "needle"))).toEqual(["a"]);
    stack.close();
  });
});
