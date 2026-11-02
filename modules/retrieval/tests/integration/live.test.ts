import type { LiveAcl } from "@rag/query-service";
import { afterEach, describe, expect, it } from "vitest";
import { connect, idsOf, rig, type ToolResult } from "../harness.js";

const open: Array<{ close(): Promise<unknown> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close().catch(() => undefined)));
});
const alice = { id: "alice", tenantId: "t1", groups: [] };
const ask = { query: "needle", limit: 10, principal: alice };
const verdict =
  (rule: (id: string) => "allow" | "deny" | "unknown"): LiveAcl =>
  async (_tenant, ids) =>
    new Map(ids.map((id) => [id, rule(id)] as const));

async function start(r: ReturnType<typeof rig>, extra = {}) {
  const h = await r.start(extra);
  open.push(h);
  return h;
}
const viaMcp = async (port: number | undefined) => {
  const c = await connect(port, "alice");
  open.push(c);
  return (await c.callTool({ name: "search", arguments: { query: "needle" } })) as ToolResult;
};

describe("retrieval with live ACL and paging", () => {
  it("drops live-denied hits over MCP and in the typed result", async () => {
    const r = rig();
    for (const id of ["a", "b"]) r.seed(id, ["alice"]);
    const h = await start(r, { liveAcl: verdict((id) => (id === "a" ? "allow" : "deny")) });
    expect(idsOf(await viaMcp(h.port))).toEqual(["a"]);
    await expect(h.search(ask)).resolves.toMatchObject({ ok: true, liveDenied: 1, truncated: false });
  });

  it("fails closed on a verifier timeout: typed LIVE_ACL, MCP error, one failure audit row", async () => {
    const r = rig();
    r.seed("a", ["alice"]);
    const h = await start(r, { liveAcl: () => new Promise(() => undefined), liveAclTimeoutMs: 10 });
    await expect(h.search(ask)).resolves.toEqual({ ok: false, code: "LIVE_ACL" });
    const res = await viaMcp(h.port);
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toBe("Search failed");
    expect(r.rows.map((row) => row.event.detail)).toEqual([
      { count: 0, outcome: "failure", code: "LIVE_ACL" },
      { count: 0, outcome: "failure", code: "LIVE_ACL" },
    ]);
  });

  it("surfaces truncated when the candidate cap stops the scan", async () => {
    const r = rig();
    for (let i = 0; i < 5; i += 1) r.seed(`d${i}`, ["alice"]);
    const h = await start(r, { maxCandidates: 3 });
    await expect(h.search({ ...ask, limit: 50 })).resolves.toMatchObject({ ok: true, truncated: true, scanned: 3 });
  });

  it("pages past the first 100 hits using the index offset", async () => {
    const r = rig();
    for (let i = 0; i < 120; i += 1) {
      const id = `a${String(i).padStart(3, "0")}`;
      r.seed(id, ["alice"]);
      // The index copy of the ACL is stale: the registry no longer lets alice see these.
      r.registry.upsert({ ...r.registry.get("t1", id)!, acl: { allowUsers: ["bob"], allowGroups: [], version: 2 } });
    }
    for (const id of ["z1", "z2"]) r.seed(id, ["alice"]);
    const h = await start(r);
    const out = await h.search({ ...ask, limit: 2 });
    expect(out).toMatchObject({ ok: true, truncated: false });
    expect(out.ok && out.pointers.map((p) => p.id)).toEqual(["z1", "z2"]);
  });
});
