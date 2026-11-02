import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { describe, expect, it } from "vitest";
import { bounded } from "../../src/runtime/timeouts.js";
import { call, connect, docs, start } from "../harness.js";

const hang = () => new Promise<never>(() => undefined);
const alice = { id: "alice", tenantId: "t1", groups: [] };
const quick = { embedMs: 60, embedQueryMs: 60, fetchTextMs: 60, listMs: 60 };

describe("timeouts on injected dependencies", () => {
  it("embedQuery: app.search rejects with a typed TimeoutError and MCP clients see an error", async () => {
    const { app } = await start({ embedQuery: hang, timeouts: quick });
    const began = Date.now();
    await expect(app.search({ query: "needle", principal: alice })).rejects.toMatchObject({ name: "TimeoutError", code: "TIMEOUT" });
    expect(Date.now() - began).toBeLessThan(2000);
    const client = await connect(app.port, "alice:t1");
    expect(await call(client)).toMatchObject({ isError: true });
    await client.close();
    await app.close();
  });

  it("embed: ingestion reports the document failures instead of hanging", async () => {
    const { app } = await start({ embed: async (ts) => (ts[0] === "dimension probe" ? ts.map(() => [1, 0]) : hang()), timeouts: quick });
    const result = await app.ingest("t1");
    expect(result.failed).toBe(3);
    // index-service reports its own code, not the cause's message.
    expect(result.failures[0]?.error).toBe("EMBED_FAILED");
    await app.close();
  });

  it("fetchText: a hanging connector read fails each document instead of hanging", async () => {
    const source = createFakeConnector("fake", docs());
    const { app } = await start({ connectorFor: () => ({ ...source, fetch: hang }), timeouts: quick });
    const result = await app.ingest("t1");
    expect(result.failed).toBe(3);
    expect(result.failures[0]?.error).toMatch(/fetchText timed out after 60ms/);
    await app.close();
  });

  it("fetchText: the injected reader is bounded too", async () => {
    const bound = bounded({ embed: async () => [], embedQuery: async () => [], connectorFor: () => undefined, fetchText: hang }, quick);
    await expect(bound.fetchText?.({} as never)).rejects.toMatchObject({ name: "TimeoutError", code: "TIMEOUT" });
  });

  it("connector.list: a hanging listing rejects the run", async () => {
    const source = createFakeConnector("fake", docs());
    const { app } = await start({ connectorFor: () => ({ ...source, list: hang }), timeouts: quick });
    await expect(app.ingest("t1")).rejects.toThrow(/connector\.list timed out after 60ms/);
    await app.close();
  });

  it("the embed timeout also bounds the startup dimension probe", async () => {
    await expect(start({ embed: hang, timeouts: quick })).rejects.toThrow(/embed timed out/);
  });

  it("a slow call inside its timeout still succeeds", async () => {
    const slow = async () => {
      await new Promise((r) => setTimeout(r, 20));
      return [1, 0];
    };
    const { app } = await start({ embedQuery: slow, timeouts: quick });
    await app.ingest("t1");
    expect(await app.search({ query: "needle", principal: alice })).toHaveLength(2);
    await app.close();
  });
});
