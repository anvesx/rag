import { afterEach, describe, expect, it } from "vitest";
import { addresses, createSource, doc, openStack, principal, scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");

describe("restart on the same directory", () => {
  it("keeps the index and the cursor: search works and nothing is re-emitted", async () => {
    const dir = tmp.make();
    const source = createSource([doc("a", ["alice"]), doc("b", ["alice"]), doc("c", ["bob"])]);
    const first = openStack(dir, { t1: source });
    await first.ingest("t1");
    const cursor = first.cursors.getCursor("t1", "fake");
    first.close();
    const second = openStack(dir, { t1: source });
    expect(second.cursors.getCursor("t1", "fake")).toBe(cursor);
    expect(addresses(await second.search(alice, "needle"))).toEqual(["a", "b"]);
    expect(await second.ingest("t1")).toMatchObject({ emitted: 0, indexed: 0, failed: 0 });
    second.close();
  });

  it("a doc deleted at the source while down is tombstoned on the next run", async () => {
    const dir = tmp.make();
    const first = openStack(dir, { t1: createSource([doc("a", ["alice"]), doc("b", ["alice"])]) });
    await first.ingest("t1");
    first.close();
    const second = openStack(dir, { t1: createSource([doc("b", ["alice"])]) });
    expect(await second.ingest("t1")).toMatchObject({ failed: 0 });
    expect(addresses(await second.search(alice, "needle"))).toEqual(["b"]);
    second.close();
  });

  it("a different directory starts empty", async () => {
    const source = createSource([doc("a", ["alice"])]);
    const first = openStack(tmp.make(), { t1: source });
    await first.ingest("t1");
    first.close();
    const other = openStack(tmp.make(), { t1: source });
    expect(await other.search(alice, "needle")).toEqual([]);
    other.close();
  });
});
