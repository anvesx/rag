import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { call, connect, start, tamper } from "../harness.js";

const rows = (path: string, tenant: string) => {
  const h = new DatabaseSync(path);
  const n = (h.prepare("SELECT count(*) AS n FROM audit WHERE tenant_id = ?").get(tenant) as { n: number }).n;
  h.close();
  return n;
};

describe("rag app audit", () => {
  it("each MCP search appends exactly one audit row and the chain verifies", async () => {
    const { app, auditDbPath } = await start();
    await app.ingest("t1");
    const client = await connect(app.port, "alice:t1");
    expect(rows(auditDbPath, "t1")).toBe(0);
    await call(client);
    expect(rows(auditDbPath, "t1")).toBe(1);
    await call(client);
    await call(client, "other words");
    expect(rows(auditDbPath, "t1")).toBe(3);
    expect(await app.verify("t1")).toEqual({ status: "ok" });
    await client.close();
    await app.close();
  });

  it("direct search is audited too and returns pointers", async () => {
    const { app, auditDbPath } = await start();
    await app.ingest("t1");
    const found = await app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    expect(found.map((p) => p.address).sort()).toEqual(["a", "b"]);
    expect(rows(auditDbPath, "t1")).toBe(1);
    await app.close();
  });

  it("tampering with the audit db makes verify fail", async () => {
    const { app, auditDbPath } = await start();
    await app.ingest("t1");
    const client = await connect(app.port, "alice:t1");
    await call(client);
    await call(client);
    tamper(auditDbPath, "UPDATE audit SET actor = 'evil' WHERE seq = 1");
    expect(await app.verify("t1")).toEqual({ status: "mismatch", brokenAt: 1 });
    await client.close();
    await app.close();
  });

  it("checkpoint lets verify detect truncation", async () => {
    const { app, auditDbPath } = await start();
    await app.ingest("t1");
    await app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    await app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    await app.checkpoint("t1");
    tamper(auditDbPath, "DELETE FROM audit WHERE seq = 2");
    expect(await app.verify("t1")).toEqual({ status: "truncated", brokenAt: 2 });
    await app.close();
  });
});
