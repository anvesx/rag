import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { realTimers } from "../../src/http/limits.js";
import { startMcpServer } from "../../src/index.js";

const base = { search: async () => [], principalFor: () => ({ id: "u", tenantId: "t", groups: [] }) };

describe("stdio in process (injected streams)", () => {
  it("answers JSON-RPC on the injected stdout, reports no port, and closes idempotently", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const lines: string[] = [];
    stdout.on("data", (d) => lines.push(String(d)));
    const server = await startMcpServer({ ...base, transport: "stdio", stdin, stdout });
    expect(server.port).toBeUndefined();
    const init = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    };
    stdin.write(`${JSON.stringify(init)}\n`);
    await new Promise((r) => setTimeout(r, 100));
    expect(lines.join("")).toContain('"serverInfo":{"name":"rag-mcp-service"');
    const first = server.close();
    expect(server.close()).toBe(first);
    await first;
  });
});

describe("configuration messages", () => {
  const msg = (extra: object) => startMcpServer({ ...base, ...extra } as never).catch((e: Error) => e.message);
  it("names the offending option", async () => {
    expect(await msg({ transport: "ws" })).toBe("unknown transport: ws");
    expect(await msg({ transport: "http", port: -1 })).toBe("invalid port: -1");
    expect(await msg({ transport: "stdio", port: 80 })).toBe("port is only valid for the http transport");
    expect(await msg({ transport: "http", maxSessions: 0 })).toBe("maxSessions must be a positive integer");
    expect(await msg({ transport: "http", idleTimeoutMs: 1.5 })).toBe("idleTimeoutMs must be a positive integer");
    expect(await msg({ transport: "http", allowedHosts: [] })).toBe("allowedHosts must not be empty");
  });
  it("binds to the given host", async () => {
    const s = await startMcpServer({ ...base, transport: "http", host: "127.0.0.1", port: 0 });
    expect(s.port).toBeGreaterThan(0);
    await s.close();
  });
});

describe("realTimers", () => {
  it("fires a scheduled callback and never fires a cleared one", async () => {
    const fired: string[] = [];
    realTimers.setTimeout(() => fired.push("kept"), 5);
    realTimers.clearTimeout(realTimers.setTimeout(() => fired.push("cleared"), 5));
    await new Promise((r) => setTimeout(r, 40));
    expect(fired).toEqual(["kept"]);
  });
});
