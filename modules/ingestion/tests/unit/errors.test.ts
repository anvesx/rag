import { RuntimeError } from "@rag/connector-runtime";
import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

describe("ingestion errors", () => {
  it("rejects an empty tenant id", async () => {
    const s = setup([doc("a")]);
    await expect(s.ingestion.runOnce("")).rejects.toBeInstanceOf(RuntimeError);
  });

  it("counts a failed delete as failed and keeps the document known", async () => {
    let failDelete = false;
    const s = setup([doc("a"), doc("b")], (svc) => ({
      apply: (e) => (e.type === "delete" && failDelete ? Promise.reject(new Error("x")) : svc.apply(e)),
    }));
    await s.ingestion.runOnce("acme");
    s.set([doc("a")]);
    failDelete = true;
    expect(await s.ingestion.runOnce("acme")).toEqual({ emitted: 1, indexed: 0, failed: 1, failures: [{ address: "b", error: "x" }], quarantined: [] });
    failDelete = false;
    expect(await s.ingestion.runOnce("acme")).toEqual({ emitted: 1, indexed: 1, failed: 0, failures: [], quarantined: [] });
  });
});
