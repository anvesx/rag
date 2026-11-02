import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);

async function twoTenants() {
  const stack = openStack(tmp.make(), {
    t1: createSource([doc("mine", ["alice"]), doc("bobs", ["bob"]), doc("eng", [], "needle", ["eng"])]),
    t2: createSource([doc("other", ["alice"]), doc("other-eng", [], "needle", ["eng"])]),
  });
  await stack.ingest("t1");
  await stack.ingest("t2");
  return stack;
}

describe("ACL across tenants", () => {
  it("denies a doc listing only another user", async () => {
    const stack = await twoTenants();
    expect(addresses(await stack.search(principal("alice", "t1"), "needle"))).toEqual(["mine"]);
    stack.close();
  });

  it("allows a doc through group membership, and not without it", async () => {
    const stack = await twoTenants();
    expect(addresses(await stack.search(principal("carol", "t1", ["eng"]), "needle"))).toEqual(["eng"]);
    expect(await stack.search(principal("carol", "t1", ["sales"]), "needle")).toEqual([]);
    stack.close();
  });

  it("never leaks across tenants, in either direction, even for the same user id or group", async () => {
    const stack = await twoTenants();
    expect(addresses(await stack.search(principal("alice", "t2"), "needle"))).toEqual(["other"]);
    expect(addresses(await stack.search(principal("alice", "t1", ["eng"]), "needle"))).toEqual(["eng", "mine"]);
    expect(addresses(await stack.search(principal("alice", "t2", ["eng"]), "needle"))).toEqual(["other", "other-eng"]);
    expect(await stack.search(principal("alice", "t3"), "needle")).toEqual([]);
    stack.close();
  });
});
