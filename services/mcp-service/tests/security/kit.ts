import { request } from "node:http";
import { type RunningMcpServer, startMcpServer } from "../../src/index.js";
import { principalFor, search } from "../integration/harness.js";

export const running: RunningMcpServer[] = [];
export const closeAll = async () => void (await Promise.all(running.splice(0).map((s) => s.close())));

export const initBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "raw", version: "1" } },
});

export async function up(extra: object = {}) {
  const s = await startMcpServer({ transport: "http", port: 0, search, principalFor, ...extra });
  running.push(s);
  return { port: s.port as number };
}

export type Raw = { status: number; body: string; sid?: string | undefined; headers: Record<string, unknown> };

/** node:http, because fetch refuses to override the Host header. */
export function raw(port: number, headers: Record<string, string>, body = initBody, method = "POST"): Promise<Raw> {
  return new Promise<Raw>((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method,
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      },
      (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: text, sid: res.headers["mcp-session-id"] as string | undefined, headers: res.headers }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
export const as = (id: string) => ({ authorization: `Bearer ${id}` });
