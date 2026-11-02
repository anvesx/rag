import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

const three = () => [doc("a"), doc("b"), doc("c")];

describe("partial runs", () => {
  it("a run that fails to list everything never tombstones", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    s.set([doc("a"), doc("x"), doc("y")]);
    const list = s.connector.list.bind(s.connector);
    let calls = 0;
    s.connector.list = async (q) => {
      if (++calls === 2) throw new Error("connection lost");
      return list(q);
    };
    await expect(s.ingestion.runOnce("acme")).rejects.toThrow("connection lost");
    expect(s.rows().map((p) => p.address)).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("a failed upsert keeps the old version while a vanished file is still tombstoned", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    s.state.failEmbed = true;
    s.set([doc("a", "v2", "new body"), doc("b")]);
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ failed: 1, indexed: 1 });
    expect(
      s
        .rows()
        .map((p) => [p.address, p.version])
        .sort(),
    ).toEqual([
      ["a", "v1"],
      ["b", "v1"],
    ]);
  });
});

describe("ACL changes", () => {
  it("a changed ACL at the same version is re-indexed", async () => {
    const s = setup([doc("a")]);
    await s.ingestion.runOnce("acme");
    s.set([{ ...doc("a"), acl: { allowUsers: ["u1", "u2"], allowGroups: [], version: 2 } }]);
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ emitted: 1, indexed: 1 });
    expect(s.rows()[0]?.acl.allowUsers).toEqual(["u1", "u2"]);
  });
});

describe("concurrent runs", () => {
  it("for one tenant are serialised, the second finds nothing left to do", async () => {
    const s = setup([doc("a"), doc("b"), doc("c")]);
    const results = await Promise.all([s.ingestion.runOnce("acme"), s.ingestion.runOnce("acme")]);
    expect(results.map((r) => r.indexed)).toEqual([3, 0]);
    expect(s.rows()).toHaveLength(3);
  });
});
