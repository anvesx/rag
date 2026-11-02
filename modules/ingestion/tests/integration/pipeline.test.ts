import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

const three = () => [doc("a"), doc("b"), doc("c")];
const counts = (emitted: number, indexed: number) => ({ emitted, indexed, failed: 0, failures: [], quarantined: [] });

describe("ingestion pipeline", () => {
  it("first run indexes all docs, rerun indexes none", async () => {
    const s = setup(three());
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(3, 3));
    expect(s.rows().map((p) => p.address)).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(0, 0));
  });

  it("pointers carry the connector's acl, zone, title and the text hash", async () => {
    const s = setup([doc("a")]);
    await s.ingestion.runOnce("acme");
    const [p] = s.rows();
    expect(p).toMatchObject({ source: "fake", title: "a", zone: "personal", version: "v1", tenantId: "acme" });
    expect(p?.acl.allowUsers).toEqual(["u1"]);
    expect(p?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("a modified file reindexes exactly one", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    s.set([doc("a"), doc("b", "v2", "changed text"), doc("c")]);
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(1, 1));
  });

  it("an index failure does not advance the cursor and a retry succeeds", async () => {
    const s = setup(three());
    s.state.failEmbed = true;
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ indexed: 0, failed: 3 });
    expect(s.cursors.getCursor("acme", "fake") ?? "").toBe("");
    s.state.failEmbed = false;
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(3, 3));
  });

  it("a deleted file is tombstoned and stays gone on rerun", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    s.set([doc("a"), doc("c")]);
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(1, 1));
    expect(
      s
        .rows()
        .map((p) => p.address)
        .sort(),
    ).toEqual(["a", "c"]);
    expect(await s.ingestion.runOnce("acme")).toEqual(counts(0, 0));
  });

  it("tenants do not share state", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    expect(await s.ingestion.runOnce("globex")).toEqual(counts(3, 3));
    s.set([doc("a")]);
    await s.ingestion.runOnce("globex");
    expect(s.rows("acme")).toHaveLength(3);
    expect(s.rows("globex")).toHaveLength(1);
  });
});
