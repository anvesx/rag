import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEnv, readOps } from "../../src/config/index.js";

const secret = "k".repeat(32);

describe("readEnv secure defaults", () => {
  it("throws when RAG_DATA_DIR is set without RAG_AUTH_SECRET", () => {
    expect(() => readEnv({ RAG_DATA_DIR: "/data" })).toThrow("RAG_AUTH_SECRET is required when RAG_DATA_DIR is set");
  });
  it("puts the audit database and anchor log under the data dir by default", () => {
    const env = readEnv({ RAG_DATA_DIR: "/data", RAG_AUTH_SECRET: secret });
    expect(env.auditDbPath).toBe(join("/data", "audit.db"));
    expect(env.anchorPath).toBe(join("/data", "anchors.log"));
  });
  it("explicit paths still win over the data dir", () => {
    const env = readEnv({ RAG_DATA_DIR: "/data", RAG_AUTH_SECRET: secret, RAG_AUDIT_DB: "/a.db", RAG_ANCHOR: "/a.log" });
    expect([env.auditDbPath, env.anchorPath]).toEqual(["/a.db", "/a.log"]);
  });
  it("reads bind host, allowed hosts and origins, folder root and tenant", () => {
    const env = readEnv({
      RAG_HOST: "0.0.0.0",
      RAG_ALLOWED_HOSTS: "rag.example.com:3000, localhost:3000",
      RAG_ALLOWED_ORIGINS: "https://app.example.com",
      RAG_FOLDER_ROOT: "/corpus",
      RAG_TENANT: "acme",
    });
    expect(env).toMatchObject({ host: "0.0.0.0", allowedHosts: ["rag.example.com:3000", "localhost:3000"], allowedOrigins: ["https://app.example.com"] });
    expect(env).toMatchObject({ folderRoot: "/corpus", tenant: "acme" });
  });
  it("requires a tenant with a folder root", () => {
    expect(() => readEnv({ RAG_FOLDER_ROOT: "/corpus" })).toThrow("RAG_TENANT");
  });
});

describe("readOps", () => {
  it("defaults to finite timeouts, a drain window and a force-exit timer", () => {
    const ops = readOps({});
    expect(ops.timeouts).toEqual({ embedMs: 30_000, embedQueryMs: 5_000, fetchTextMs: 30_000, listMs: 30_000 });
    expect(ops.drainMs).toBeLessThan(ops.forceExitMs);
  });
  it("reads every timeout from the environment", () => {
    const ops = readOps({
      RAG_EMBED_TIMEOUT_MS: "11",
      RAG_EMBED_QUERY_TIMEOUT_MS: "22",
      RAG_FETCH_TIMEOUT_MS: "33",
      RAG_LIST_TIMEOUT_MS: "44",
      RAG_DRAIN_MS: "55",
      RAG_FORCE_EXIT_MS: "66",
      RAG_HEALTH_PORT: "9090",
    });
    expect(ops).toMatchObject({ timeouts: { embedMs: 11, embedQueryMs: 22, fetchTextMs: 33, listMs: 44 }, drainMs: 55, forceExitMs: 66, healthPort: 9090 });
  });
  it.each(["0", "-1", "abc", "1.5", ""])("rejects a timeout of %j", (raw) => {
    expect(() => readOps({ RAG_EMBED_TIMEOUT_MS: raw })).toThrow("RAG_EMBED_TIMEOUT_MS");
  });
  it("health port defaults to the service port plus one", () => {
    expect(readOps({}, 3000).healthPort).toBe(3001);
    expect(readOps({}, 0).healthPort).toBe(0);
  });
});
