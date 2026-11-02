import { describe, expect, it } from "vitest";
import { docId } from "../../src/index.js";
import { doc, setup } from "../support/harness.js";

const ids = (...addresses: string[]) => addresses.map((a) => docId("fake", a));

async function ingested() {
  const s = setup([doc("a"), doc("b"), doc("c")]);
  await s.ingestion.runOnce("acme");
  return s;
}

describe("known seed on a partial run", () => {
  it("a listing that is not complete never tombstones seeded docs", async () => {
    const s = await ingested();
    s.set([doc("a"), doc("x"), doc("y")]);
    const list = s.connector.list.bind(s.connector);
    let calls = 0;
    s.connector.list = async (q) => {
      if (++calls === 2) throw new Error("connection lost");
      return list(q);
    };
    await expect(s.reopen(() => ids("a", "b", "c")).runOnce("acme")).rejects.toThrow("connection lost");
    expect(s.rows().map((p) => p.address)).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("a failing seed rejects the run without tombstoning", async () => {
    const s = await ingested();
    s.set([]);
    const broken = s.reopen(() => {
      throw new Error("registry down");
    });
    await expect(broken.runOnce("acme")).rejects.toThrow("registry down");
    expect(s.rows()).toHaveLength(3);
  });
});
