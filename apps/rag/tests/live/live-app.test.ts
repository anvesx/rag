import { describe, expect, it } from "vitest";
import { call, connect, idsOf, start } from "../harness.js";
import { defaultGrants, guarded } from "./support.js";

const alice = { id: "alice", tenantId: "t1", groups: [] };
const live = (source: ReturnType<typeof guarded>, over = {}) =>
  start({
    connectorFor: (t) => (t === "t1" ? source : undefined),
    tokenFor: (t) => (t === "t1" ? "token-t1" : undefined),
    userTokenFor: (p) => `user-${p.id}`,
    liveAclTimeoutMs: 50,
    ...over,
  });
const addresses = (pointers: Array<{ address: string }>) => pointers.map((p) => p.address).sort();

describe("rag app with the connector live ACL", () => {
  it("allows what the source still allows and drops what it revoked, though the cached ACL says yes", async () => {
    const grants = defaultGrants();
    const { app } = await live(guarded(grants));
    await app.ingest("t1");
    expect(addresses(await app.search({ query: "needle", principal: alice }))).toEqual(["a", "b"]);
    grants.set("b", ["bob"]);
    expect(addresses(await app.search({ query: "needle", principal: alice }))).toEqual(["a"]);
    await app.close();
  });

  it("serves the same live result over MCP", async () => {
    const grants = defaultGrants();
    const { app } = await live(guarded(grants));
    await app.ingest("t1");
    grants.set("a", ["bob"]);
    const client = await connect(app.port, "alice:t1");
    expect(idsOf(await call(client))).toEqual(["b"]);
    await client.close();
    await app.close();
  });

  it("fails closed when the source does not answer in time: typed LIVE_ACL, MCP error, nothing returned", async () => {
    const { app } = await live(guarded(defaultGrants(), new Set(["a", "b"])));
    await app.ingest("t1");
    await expect(app.search({ query: "needle", principal: alice })).rejects.toMatchObject({ name: "RetrievalError", code: "LIVE_ACL" });
    const client = await connect(app.port, "alice:t1");
    const res = (await call(client)) as { isError?: boolean; content: Array<{ text: string }> };
    expect(res).toMatchObject({ isError: true, content: [{ text: "Search failed" }] });
    await client.close();
    await app.close();
  });

  it("fails closed when the user has no token", async () => {
    const { app } = await live(guarded(defaultGrants()), { userTokenFor: () => undefined });
    await app.ingest("t1");
    await expect(app.search({ query: "needle", principal: alice })).rejects.toMatchObject({ code: "LIVE_ACL" });
    await app.close();
  });

  it("keeps the audit rule: a successful live search is audited", async () => {
    const { app } = await live(guarded(defaultGrants()));
    await app.ingest("t1");
    await app.search({ query: "needle", principal: alice });
    expect(await app.verify("t1")).toMatchObject({ status: "ok" });
    await app.close();
  });
});

describe("fetchText is optional", () => {
  it("ingests and searches without it", async () => {
    const { app } = await start({ fetchText: undefined });
    expect(await app.ingest("t1")).toMatchObject({ emitted: 3, indexed: 3, failed: 0 });
    expect(addresses(await app.search({ query: "needle", principal: alice }))).toEqual(["a", "b"]);
    await app.close();
  });
});
