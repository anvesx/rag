import { afterEach, describe, expect, it } from "vitest";
import { connect, idsOf, rig } from "../harness.js";

const open: Array<{ close(): Promise<unknown> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close().catch(() => undefined)));
});
const asUser = async (r: ReturnType<typeof rig>) => {
  const h = await r.start();
  open.push(h);
  return async (token: string, args: Record<string, unknown> = { query: "needle" }) => {
    const c = await connect(h.port, token);
    open.push(c);
    return idsOf(await c.callTool({ name: "search", arguments: args }));
  };
};

describe("retrieval over real HTTP MCP", () => {
  it("returns visible pointers end to end", async () => {
    const r = rig();
    r.seed("pub-group", [], ["eng"]);
    r.seed("pub-user", ["alice"]);
    const as = await asUser(r);
    expect((await as("alice:eng")).sort()).toEqual(["pub-group", "pub-user"]);
  });

  it("never returns ACL-hidden or cross-tenant docs", async () => {
    const r = rig();
    r.seed("mine", ["alice"]);
    r.seed("secret", ["bob"]);
    r.seed("other-tenant", ["alice"], [], "t2");
    const as = await asUser(r);
    expect(await as("alice")).toEqual(["mine"]);
    expect(await as("carol")).toEqual([]);
  });

  it("honours a registry revocation before re-indexing", async () => {
    const r = rig();
    r.seed("doc", ["alice"]);
    const as = await asUser(r);
    expect(await as("alice")).toEqual(["doc"]);
    const current = r.registry.get("t1", "doc");
    if (!current) throw new Error("seeded");
    r.registry.upsert({ ...current, version: "v2", acl: { allowUsers: [], allowGroups: [], version: 2 } });
    expect(await as("alice")).toEqual([]);
  });

  it("passes the tool limit through", async () => {
    const r = rig();
    for (const id of ["a", "b", "c"]) r.seed(id, ["alice"]);
    const as = await asUser(r);
    expect(await as("alice", { query: "needle", limit: 2 })).toHaveLength(2);
  });
});
