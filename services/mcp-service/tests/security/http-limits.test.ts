import { afterEach, describe, expect, it } from "vitest";
import { fakeTimers } from "./fake-timers.js";
import { as, closeAll, raw, up } from "./kit.js";

afterEach(closeAll);

describe("session caps over HTTP", () => {
  it("answers 429 with a generic body once maxSessions is reached, and recovers after idle expiry", async () => {
    const timers = fakeTimers();
    const { port } = await up({ maxSessions: 2, idleTimeoutMs: 1000, timers });
    const a = await raw(port, as("a"));
    const b = await raw(port, as("b"));
    expect([a.status, b.status]).toEqual([200, 200]);
    const over = await raw(port, as("c"));
    expect(over.status).toBe(429);
    expect(JSON.parse(over.body).error.message).toBe("Too many sessions");
    timers.advance(1000);
    await new Promise((r) => setTimeout(r, 20));
    expect((await raw(port, { ...as("a"), "mcp-session-id": a.sid as string }, "{}")).status).toBe(404);
    expect((await raw(port, as("c"))).status).toBe(200);
  });

  it("caps sessions per principal without blocking others", async () => {
    const { port } = await up({ maxSessionsPerPrincipal: 1 });
    expect((await raw(port, as("alice"))).status).toBe(200);
    const second = await raw(port, as("alice"));
    expect(second.status).toBe(429);
    expect(second.body).not.toContain("alice");
    expect((await raw(port, as("b"))).status).toBe(200);
  });

  it("rejects invalid limits with INVALID_CONFIG", async () => {
    await expect(up({ maxSessions: 0 })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
  });
});

describe("DNS rebinding protection", () => {
  it("serves the bound loopback Host and rejects any other Host with 403 before a session opens", async () => {
    const { port } = await up();
    expect((await raw(port, { ...as("a"), host: `localhost:${port}` })).status).toBe(200);
    const bad = await raw(port, { ...as("a"), host: "evil.example" });
    expect(bad.status).toBe(403);
    expect(bad.sid).toBeUndefined();
    expect((await raw(port, { ...as("a"), host: `127.0.0.1:${port + 1}` })).status).toBe(403);
  });

  it("rejects a foreign Origin and honours configured lists", async () => {
    const { port } = await up({ allowedHosts: ["rag.internal"], allowedOrigins: ["https://app.internal"] });
    expect((await raw(port, { ...as("a"), host: "rag.internal", origin: "https://app.internal" })).status).toBe(200);
    expect((await raw(port, { ...as("b"), host: "rag.internal", origin: "https://evil.example" })).status).toBe(403);
    expect((await raw(port, { ...as("c"), host: `127.0.0.1:${port}` })).status).toBe(403);
  });
});
