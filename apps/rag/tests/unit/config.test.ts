import { describe, expect, it } from "vitest";
import { start } from "../harness.js";

describe("createRagApp configuration", () => {
  it("stdio transport has no port", async () => {
    const { Readable, Writable } = await import("node:stream");
    const { app } = await start({
      transport: "stdio",
      port: undefined,
      stdin: new Readable({ read() {} }),
      stdout: new Writable({ write: (_c, _e, cb) => cb() }),
    });
    expect(app.port).toBeUndefined();
    await app.close();
  });

  it("uses the embedding dimension of the injected embed function", async () => {
    const { app } = await start({ embed: async (ts) => ts.map(() => [1, 0, 0, 0, 0]), embedQuery: async () => [1, 0, 0, 0, 0] });
    expect(await app.ingest("t1")).toMatchObject({ indexed: 3 });
    const found = await app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    expect(found).toHaveLength(2);
    await app.close();
  });

  it("probes the dimension with one non-empty text", async () => {
    const seen: string[][] = [];
    const { app } = await start({
      embed: async (ts) => {
        seen.push(ts);
        return ts.map(() => [1, 0]);
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(1);
    expect(seen[0]?.[0]?.length).toBeGreaterThan(0);
    await app.close();
  });

  it("rejects when the probe returns no vector", async () => {
    await expect(start({ embed: async () => [] })).rejects.toThrow("dimension probe");
  });

  it("search honours limit", async () => {
    const { app } = await start();
    await app.ingest("t1");
    const principal = { id: "alice", tenantId: "t1", groups: [] };
    expect(await app.search({ query: "needle", principal, limit: 1 })).toHaveLength(1);
    expect(await app.search({ query: "needle", principal })).toHaveLength(2);
    await app.close();
  });

  it("an explicit dimension skips the probe", async () => {
    let calls = 0;
    const { app } = await start({
      dimension: 2,
      embed: async (ts) => {
        calls += 1;
        return ts.map(() => [1, 0]);
      },
    });
    expect(calls).toBe(0);
    await app.close();
  });

  it("an embed failure at startup rejects", async () => {
    await expect(
      start({
        embed: async () => {
          throw new Error("down");
        },
      }),
    ).rejects.toThrow("down");
  });
});
