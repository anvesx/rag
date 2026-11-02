import { describe, expect, it } from "vitest";
import { isLoopback, readTokenPolicy, requireAuthMode } from "../../src/auth/mode.js";
import { readEnv } from "../../src/config/index.js";

const secret = "k".repeat(32);

describe("unsigned tokens", () => {
  it.each(["127.0.0.1", "localhost", "::1", "[::1]", "127.9.9.9"])("%s is loopback", (host) => expect(isLoopback(host)).toBe(true));
  it.each(["0.0.0.0", "::", "10.0.0.5", "rag.example.com", "127.0.0.1.evil.com"])("%s is not loopback", (host) => expect(isLoopback(host)).toBe(false));
  it("are allowed only in demo on loopback", () => {
    expect(() => requireAuthMode(readEnv({ RAG_DEMO: "1" }))).not.toThrow();
    expect(() => requireAuthMode(readEnv({ RAG_DEMO: "1", RAG_HOST: "localhost" }))).not.toThrow();
  });
  it("are refused on a non-loopback host even in demo", () => {
    expect(() => requireAuthMode(readEnv({ RAG_DEMO: "1", RAG_HOST: "0.0.0.0" }))).toThrow("RAG_AUTH_SECRET");
  });
  it("are refused outside demo, loopback or not", () => {
    expect(() => requireAuthMode(readEnv({ RAG_FOLDER_ROOT: "/c", RAG_TENANT: "acme" }))).toThrow("RAG_AUTH_SECRET");
  });
  it("a secret is always enough", () => {
    expect(() => requireAuthMode(readEnv({ RAG_HOST: "0.0.0.0", RAG_AUTH_SECRET: secret }))).not.toThrow();
  });
});

describe("readTokenPolicy", () => {
  it("defaults to a 24 hour maximum lifetime and no extra keys", () => {
    expect(readTokenPolicy({})).toEqual({ maxLifetimeSeconds: 86_400 });
  });
  it("reads keys and a maximum lifetime", () => {
    const keys = { k1: "a".repeat(32) };
    expect(readTokenPolicy({ RAG_AUTH_KEYS: JSON.stringify(keys), RAG_TOKEN_MAX_TTL_SECONDS: "600" })).toEqual({ keys, maxLifetimeSeconds: 600 });
  });
  it.each(["not json", "[]", '{"k":"short"}', `{"bad kid":"${"a".repeat(32)}"}`])("rejects RAG_AUTH_KEYS %j", (raw) => {
    expect(() => readTokenPolicy({ RAG_AUTH_KEYS: raw })).toThrow("RAG_AUTH_KEYS");
  });
  it.each(["0", "-5", "x"])("rejects a maximum lifetime of %j", (raw) => {
    expect(() => readTokenPolicy({ RAG_TOKEN_MAX_TTL_SECONDS: raw })).toThrow("RAG_TOKEN_MAX_TTL_SECONDS");
  });
});
