import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

describe("tenant-bound connectors", () => {
  it("an unknown tenant is a typed error and nothing is indexed", async () => {
    const s = setup([doc("a")], undefined, ["acme"]);
    await expect(s.ingestion.runOnce("globex")).rejects.toMatchObject({ name: "IngestionError", code: "UNKNOWN_TENANT" });
    expect(s.rows("globex")).toEqual([]);
    expect(s.cursors.getCursor("globex", "fake")).toBeUndefined();
  });

  it("fetches with the credential of the tenant being ingested", async () => {
    const s = setup([doc("a")]);
    await s.ingestion.runOnce("acme");
    await s.ingestion.runOnce("globex");
    expect(s.tokens.filter((t) => t !== "t")).toEqual(["token-acme", "token-globex"]);
  });
});
