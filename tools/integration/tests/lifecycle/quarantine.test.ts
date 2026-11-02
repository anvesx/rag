import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");

describe("connector failure", () => {
  it("quarantines the failing doc after maxAttempts without blocking the others", async () => {
    const source = createSource([doc("a", ["alice"]), doc("bad", ["alice"]), doc("c", ["alice"])]);
    source.failFetch("bad", true);
    const stack = openStack(tmp.make(), { t1: source }, { maxAttempts: 2 });
    const first = await stack.ingest("t1");
    expect(first).toMatchObject({ indexed: 2, failed: 1, quarantined: [] });
    expect(first.failures.map((f) => f.address)).toEqual(["bad"]);
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["a", "c"]);
    const second = await stack.ingest("t1");
    expect(second.quarantined.map((f) => f.address)).toEqual(["bad"]);
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["a", "c"]);
    stack.close();
  });

  it("a doc added later still indexes while another is quarantined", async () => {
    const source = createSource([doc("bad", ["alice"])]);
    source.failFetch("bad", true);
    const stack = openStack(tmp.make(), { t1: source }, { maxAttempts: 1 });
    await stack.ingest("t1");
    source.put(doc("late", ["alice"]));
    expect(await stack.ingest("t1")).toMatchObject({ indexed: 1 });
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["late"]);
    stack.close();
  });

  it("a quarantined doc recovers when it gets a new version", async () => {
    const source = createSource([doc("bad", ["alice"])]);
    source.failFetch("bad", true);
    const stack = openStack(tmp.make(), { t1: source }, { maxAttempts: 1 });
    await stack.ingest("t1");
    source.failFetch("bad", false);
    source.put(doc("bad", ["alice"], "needle", [], { version: "v2" }));
    expect(await stack.ingest("t1")).toMatchObject({ indexed: 1, failed: 0, quarantined: [] });
    expect(addresses(await stack.search(alice, "needle"))).toEqual(["bad"]);
    stack.close();
  });
});
