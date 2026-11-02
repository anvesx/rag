import { afterEach, describe, expect, it } from "vitest";
import { connect, idsOf, rig, type ToolResult } from "../harness.js";

const open: Array<{ close(): Promise<unknown> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close().catch(() => undefined)));
});
const call = async (r: ReturnType<typeof rig>, token = "alice", args: Record<string, unknown> = { query: "needle" }) => {
  const h = await r.start();
  open.push(h);
  const c = await connect(h.port, token);
  open.push(c);
  return (await c.callTool({ name: "search", arguments: args })) as ToolResult;
};

describe("every MCP search is audited", () => {
  it("writes exactly one row per search, under the caller's tenant, before results come back", async () => {
    const r = rig();
    r.seed("doc", ["alice"]);
    const res = await call(r);
    expect(idsOf(res)).toEqual(["doc"]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ tenantId: "t1", event: { actor: "alice", action: "search", detail: { count: 1 } } });
    expect(JSON.stringify(r.rows)).not.toContain("needle");
  });
  it("audits a search that returns nothing", async () => {
    const r = rig();
    r.seed("doc", ["bob"]);
    await call(r);
    expect(r.rows[0]?.event.detail).toEqual({ count: 0 });
  });
  it("fails closed: an audit failure returns a safe MCP error and no pointers", async () => {
    const r = rig();
    r.seed("doc", ["alice"]);
    r.audit.failWith = new Error("db-password-leak");
    const res = await call(r);
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toBe("Search failed");
    expect(JSON.stringify(res)).not.toMatch(/doc|db-password-leak/);
  });
  it("writes no row when the search itself fails", async () => {
    const bad = rig({ embedQuery: async () => [1, 0, 0] });
    const res = await call(bad);
    expect(res.isError).toBe(true);
    expect(bad.rows).toHaveLength(0);
  });
  it("refuses to start without an audit service or key", async () => {
    await expect(rig().start({ audit: undefined as never })).rejects.toMatchObject({ code: "CONFIG" });
    await expect(rig().start({ auditKey: "" })).rejects.toMatchObject({ code: "CONFIG" });
  });
});
