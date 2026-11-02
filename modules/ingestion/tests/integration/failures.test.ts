import type { IndexService } from "@rag/index-service";
import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

/** Index service that rejects every upsert for `address` while `on()` is true. */
const rejecting =
  (address: string, on: () => boolean) =>
  (svc: IndexService): IndexService => ({
    apply: (e) => (e.type === "upsert" && e.pointer.address === address && on() ? Promise.reject(new Error("bad doc")) : svc.apply(e)),
  });
const addresses = (rows: Array<{ address: string }>) => rows.map((p) => p.address).sort();

describe("a failing document", () => {
  it("does not block the others and is reported, not swallowed", async () => {
    const s = setup(
      [doc("a"), doc("b"), doc("c")],
      rejecting("b", () => true),
    );
    const result = await s.ingestion.runOnce("acme");
    expect(result).toMatchObject({ emitted: 3, indexed: 2, failed: 1, failures: [{ address: "b", error: "bad doc" }] });
    expect(addresses(s.rows())).toEqual(["a", "c"]);
  });

  it("does not stop deletes of documents that vanished", async () => {
    let broken = false;
    const s = setup(
      [doc("a"), doc("b"), doc("c")],
      rejecting("b", () => broken),
    );
    await s.ingestion.runOnce("acme");
    broken = true;
    s.set([doc("a"), doc("b", "v2", "new")]);
    const result = await s.ingestion.runOnce("acme");
    expect(result.failures).toEqual([{ address: "b", error: "bad doc" }]);
    expect(addresses(s.rows())).toEqual(["a", "b"]);
    expect(s.rows().find((p) => p.address === "b")?.version).toBe("v1");
  });

  it("a failed delete is reported with its address", async () => {
    const s = setup([doc("a"), doc("b")], (svc) => ({ apply: (e) => (e.type === "delete" ? Promise.reject(new Error("no")) : svc.apply(e)) }));
    await s.ingestion.runOnce("acme");
    s.set([doc("a")]);
    expect((await s.ingestion.runOnce("acme")).failures).toEqual([{ address: "b", error: "no" }]);
  });

  it("is quarantined after three runs and returned every run after", async () => {
    const s = setup(
      [doc("a"), doc("b")],
      rejecting("b", () => true),
    );
    for (let i = 0; i < 2; i++) expect((await s.ingestion.runOnce("acme")).quarantined).toEqual([]);
    const third = await s.ingestion.runOnce("acme");
    expect(third.quarantined).toEqual([{ address: "b", error: "bad doc" }]);
    const fourth = await s.ingestion.runOnce("acme");
    expect(fourth).toMatchObject({ emitted: 0, failed: 0, failures: [], quarantined: [{ address: "b", error: "bad doc" }] });
  });
});
