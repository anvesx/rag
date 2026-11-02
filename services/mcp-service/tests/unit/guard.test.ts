import { describe, expect, it } from "vitest";
import { defaultPolicy, hostAllowed, resolvePolicy } from "../../src/http/guard.js";

describe("host and origin policy", () => {
  it("defaults to loopback names with the bound port", () => {
    expect(defaultPolicy(4000)).toEqual({
      allowedHosts: ["localhost:4000", "127.0.0.1:4000", "[::1]:4000"],
      allowedOrigins: ["http://localhost:4000", "http://127.0.0.1:4000", "http://[::1]:4000"],
    });
  });
  it("allows listed hosts, rejects missing or unlisted hosts", () => {
    const p = defaultPolicy(4000);
    expect(hostAllowed(p, { host: "127.0.0.1:4000" })).toBe(true);
    expect(hostAllowed(p, { host: "evil.example:4000" })).toBe(false);
    expect(hostAllowed(p, { host: "127.0.0.1:4001" })).toBe(false);
    expect(hostAllowed(p, {})).toBe(false);
  });
  it("accepts a missing Origin but rejects an unlisted one", () => {
    const p = defaultPolicy(4000);
    expect(hostAllowed(p, { host: "localhost:4000", origin: "http://localhost:4000" })).toBe(true);
    expect(hostAllowed(p, { host: "localhost:4000", origin: "http://evil.example" })).toBe(false);
  });
  it("lets configuration replace either list and rejects an empty host list", () => {
    const p = resolvePolicy(4000, { allowedHosts: ["rag.internal"], allowedOrigins: ["https://app.internal"] });
    expect(p).toEqual({ allowedHosts: ["rag.internal"], allowedOrigins: ["https://app.internal"] });
    expect(resolvePolicy(4000, { allowedHosts: ["a"] }).allowedOrigins).toEqual(defaultPolicy(4000).allowedOrigins);
    expect(() => resolvePolicy(4000, { allowedHosts: [] })).toThrow(/allowedHosts/);
  });
});
