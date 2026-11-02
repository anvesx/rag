import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type Health = { port: number; close(): Promise<void> };

/**
 * `/healthz` (the process is up) and `/readyz` (stores answer and shutdown has not begun), JSON bodies, no auth, no other paths.
 * Separate from the MCP port on purpose: that server answers only `/mcp` and checks Host before anything else.
 */
export async function startHealth(opts: { port: number; host: string; draining: () => boolean; probe: () => void | Promise<void> }): Promise<Health> {
  const server = createServer(async (req, res) => {
    const path = (req.url ?? "").split("?")[0];
    let status = 200;
    let body: Record<string, string> = { status: "ok" };
    if (req.method !== "GET" || (path !== "/healthz" && path !== "/readyz")) {
      status = 404;
      body = { status: "not found" };
    } else if (path === "/readyz") {
      try {
        await opts.probe();
        if (opts.draining()) [status, body] = [503, { status: "draining" }];
        else body = { status: "ready" };
      } catch {
        [status, body] = [503, { status: "unavailable" }];
      }
    }
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.host, resolve);
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
