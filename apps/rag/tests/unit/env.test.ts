import { describe, expect, it } from "vitest";
import { demoDeps, readEnv } from "../../src/config/index.js";

const bearer = (token: string) => ({ requestInfo: { headers: { authorization: token } } });

describe("readEnv", () => {
  it("applies defaults", () => {
    expect(readEnv({})).toEqual({ port: 3000, auditDbPath: "rag-audit.db", anchorPath: "rag-anchors.log", demo: false });
  });
  it("reads every variable", () => {
    const env = { RAG_PORT: "8080", RAG_AUDIT_DB: "/d/a.db", RAG_ANCHOR: "/d/a.log", RAG_DEMO: "1" };
    expect(readEnv(env)).toEqual({ port: 8080, auditDbPath: "/d/a.db", anchorPath: "/d/a.log", demo: true });
  });
  it("reads RAG_DATA_DIR and RAG_AUTH_SECRET", () => {
    const secret = "k".repeat(32);
    expect(readEnv({ RAG_DATA_DIR: "/data", RAG_AUTH_SECRET: secret })).toMatchObject({ dataDir: "/data", authSecret: secret });
  });
  it("rejects an auth secret shorter than 32 characters", () => {
    expect(() => readEnv({ RAG_AUTH_SECRET: "k".repeat(31) })).toThrow("RAG_AUTH_SECRET");
  });
  it("demo only for the exact value 1", () => {
    expect(readEnv({ RAG_DEMO: "true" }).demo).toBe(false);
    expect(readEnv({ RAG_DEMO: "0" }).demo).toBe(false);
  });
  it("accepts the whole port range", () => {
    expect(readEnv({ RAG_PORT: "0" }).port).toBe(0);
    expect(readEnv({ RAG_PORT: "65535" }).port).toBe(65535);
  });
  it.each(["abc", "65536", "70000", "1.5", "", " ", "-1", " 80", "123456", "1e3"])("rejects port %j", (raw) => {
    expect(() => readEnv({ RAG_PORT: raw })).toThrow(`invalid RAG_PORT: ${raw}`);
  });
});

describe("demoDeps", () => {
  it("serves two in-memory documents with fetchable text", async () => {
    const d = demoDeps();
    expect(d.connectorFor("globex")).toBeUndefined();
    expect(d.tokenFor("globex")).toBeUndefined();
    const { items } = await d.connectorFor("acme")!.list({ limit: 10 });
    expect(items.map((i) => [i.address, i.title, i.acl.allowUsers, i.zone])).toEqual([
      ["welcome", "welcome", ["alice"], "team"],
      ["faq", "faq", ["alice"], "team"],
    ]);
    const pointer = (address: string) => ({ address }) as never;
    expect(await d.fetchText!(pointer("welcome"))).toBe("Welcome to the RAG demo.");
    expect(await d.fetchText!(pointer("faq"))).toBe("Ask the index a question.");
  });
  it("embeds documents and queries to the same two-dimensional space", async () => {
    const d = demoDeps();
    expect(await d.embed(["hello", "hi"])).toEqual([
      [5, 1],
      [2, 1],
    ]);
    expect(await d.embedQuery("abc")).toEqual([3, 1]);
  });
  it("uses the wall clock", () => {
    const d = demoDeps();
    expect(Math.abs(d.clock() - Date.now())).toBeLessThan(1000);
  });
  it("principalFor reads user:tenant from the bearer token", () => {
    const { principalFor } = demoDeps();
    expect(principalFor(bearer("Bearer alice:acme"))).toEqual({ id: "alice", tenantId: "acme", groups: [] });
  });
  it.each([bearer("Bearer alice"), bearer("alice:acme"), bearer("Bearer :acme"), bearer("Bearer alice:"), bearer(""), {}])(
    "principalFor rejects %j",
    (extra) => {
      expect(() => demoDeps().principalFor(extra)).toThrow("unauthenticated");
    },
  );
});
