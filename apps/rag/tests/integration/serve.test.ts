import { createFakeConnector } from "@brain/connector-kit/testing";
import { describe, expect, it } from "vitest";
import { call, connect, doc, docs, idsOf, start } from "../harness.js";

describe("rag app over MCP HTTP", () => {
  it("returns only the documents the caller may see", async () => {
    const { app } = await start();
    expect(await app.ingest("t1")).toMatchObject({ emitted: 3, indexed: 3, failed: 0 });
    const alice = await connect(app.port, "alice:t1");
    expect(idsOf(await call(alice))).toEqual(["a", "b"]);
    const bob = await connect(app.port, "bob:t1");
    expect(idsOf(await call(bob))).toEqual(["hidden"]);
    await alice.close();
    await bob.close();
    await app.close();
  });

  it("never returns another tenant's documents", async () => {
    const { app } = await start();
    await app.ingest("t1");
    await app.ingest("t2");
    const client = await connect(app.port, "alice:t2");
    expect(idsOf(await call(client))).toEqual(["x", "y"]);
    const t1 = await connect(app.port, "alice:t1");
    expect(idsOf(await call(t1))).toEqual(["a", "b"]);
    await t1.close();
    const stranger = await connect(app.port, "alice:t3");
    expect(idsOf(await call(stranger))).toEqual([]);
    await client.close();
    await stranger.close();
    await app.close();
  });

  it("refuses to ingest a tenant that has no connector of its own", async () => {
    const { app } = await start();
    await expect(app.ingest("t3")).rejects.toMatchObject({ name: "IngestionError", code: "UNKNOWN_TENANT" });
    const stranger = await connect(app.port, "alice:t3");
    expect(idsOf(await call(stranger))).toEqual([]);
    await stranger.close();
    await app.close();
  });

  it("ingest reports per-document failures instead of succeeding silently", async () => {
    const { app } = await start({
      embed: async (ts) => {
        if (ts.some((t) => t.includes("boom"))) throw new Error("embed down");
        return ts.map(() => [1, 0]);
      },
      // Ingestion hands the index the text it fetched, so the bad document's body comes from the connector.
      connectorFor: () => createFakeConnector("fake", [doc("a", ["alice"]), doc("b", ["alice"], "boom"), doc("hidden", ["bob"])]),
    });
    const result = await app.ingest("t1");
    expect(result).toMatchObject({ indexed: 2, failed: 1 });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.address).toBe("b");
    await app.close();
  });

  it("answers 401 without credentials", async () => {
    const { app } = await start();
    const res = await fetch(`http://127.0.0.1:${app.port}/mcp`, { method: "POST" });
    expect(res.status).toBe(401);
    await app.close();
  });

  it("close is idempotent and frees the port", async () => {
    const { app } = await start();
    const port = app.port;
    await app.close();
    await app.close();
    await expect(fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST" })).rejects.toThrow();
    expect(docs()).toHaveLength(3);
  });
});
