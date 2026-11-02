import { request } from "node:http";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { start } from "../harness.js";

const get = async (port: number | undefined, path: string) => {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
  const { port } = probe.address() as { port: number };
  await new Promise((r) => probe.close(r));
  return port;
}

// node's fetch will not let us set Host, so go through http.request.
const status = (port: number, host: string) =>
  new Promise<number>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/mcp", method: "POST", headers: { host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.once("error", reject);
    req.end();
  });

describe("health endpoints", () => {
  it("/healthz is 200 and /readyz is 200 once stores are reachable", async () => {
    const { app } = await start({ healthPort: 0 });
    expect(await get(app.healthPort, "/healthz")).toEqual({ status: 200, body: { status: "ok" } });
    expect(await get(app.healthPort, "/readyz")).toEqual({ status: 200, body: { status: "ready" } });
    expect((await get(app.healthPort, "/nope")).status).toBe(404);
    await app.close();
  });
  it("is off unless a health port is given", async () => {
    const { app } = await start();
    expect(app.healthPort).toBeUndefined();
    await app.close();
  });
  it("/readyz turns 503 while draining and /healthz stays 200", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { app } = await start({
      healthPort: 0,
      drainMs: 5000,
      embedQuery: async () => {
        await gate;
        return [1, 0];
      },
    });
    await app.ingest("t1");
    const { healthPort: port } = app;
    const inflight = app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    const closing = app.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(await get(port, "/readyz")).toEqual({ status: 503, body: { status: "draining" } });
    expect((await get(port, "/healthz")).status).toBe(200);
    release();
    await Promise.all([inflight, closing]);
    await expect(get(port, "/healthz")).rejects.toThrow();
  });
});

describe("bind host and allowed hosts", () => {
  it("only Host headers on the allow-list reach authentication", async () => {
    const port = await freePort();
    const { app } = await start({ port, allowedHosts: [`rag.test:${port}`], allowedOrigins: [] });
    expect(await status(port, `rag.test:${port}`)).toBe(401);
    expect([await status(port, `evil.test:${port}`), await status(port, `127.0.0.1:${port}`)]).toEqual([403, 403]);
    await app.close();
  });
  it("binds the configured host", async () => {
    const { app } = await start({ host: "0.0.0.0" });
    expect((await fetch(`http://127.0.0.1:${app.port}/mcp`, { method: "POST" })).status).toBe(401);
    await app.close();
  });
});
