import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");
const bob = principal("bob", "t1");
const acl = (users: string[], groups: string[] = []) => ({ acl: { allowUsers: users, allowGroups: groups, version: 2 } });

describe("ACL change at the source", () => {
  it("tightening is reflected after re-ingest, with the version unchanged", async () => {
    const source = createSource([doc("a", ["alice", "bob"]), doc("b", ["alice", "bob"])]);
    const stack = openStack(tmp.make(), { t1: source });
    await stack.ingest("t1");
    expect(addresses(await stack.search(bob, "needle"))).toEqual(["a", "b"]);
    source.put(doc("a", ["alice"], "needle", [], acl(["alice"])));
    expect(await stack.ingest("t1")).toMatchObject({ emitted: 1, failed: 0 });
    expect(addresses(await stack.search(bob, "needle"))).toEqual(["b"]);
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["a", "b"]);
    stack.close();
  });

  it("is not reflected before re-ingest, and widening is reflected after", async () => {
    const source = createSource([doc("a", ["alice"])]);
    const stack = openStack(tmp.make(), { t1: source });
    await stack.ingest("t1");
    source.put(doc("a", ["alice", "bob"], "needle", [], acl(["alice", "bob"])));
    expect(await stack.search(bob, "needle")).toEqual([]);
    await stack.ingest("t1");
    expect(addresses(await stack.search(bob, "needle"))).toEqual(["a"]);
    stack.close();
  });

  it("revoking a group is reflected after re-ingest", async () => {
    const source = createSource([doc("a", [], "needle", ["eng"])]);
    const stack = openStack(tmp.make(), { t1: source });
    const carol = principal("carol", "t1", ["eng"]);
    await stack.ingest("t1");
    expect(addresses(await stack.search(carol, "needle"))).toEqual(["a"]);
    source.put(doc("a", [], "needle", [], acl([])));
    await stack.ingest("t1");
    expect(await stack.search(carol, "needle")).toEqual([]);
    stack.close();
  });
});
