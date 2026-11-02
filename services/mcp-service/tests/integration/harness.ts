import type { Pointer, Principal } from "@anvesx/core-types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type RunningMcpServer, startMcpServer } from "../../src/index.js";

export const pointer: Pointer = {
  id: "p-1",
  tenantId: "tenant-1",
  source: "drive",
  address: "drive://doc/1",
  title: "",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

/** Bearer token == user id. A missing header is unauthenticated. */
export function principalFor(extra: unknown): Principal {
  const headers = (extra as { requestInfo?: { headers?: Record<string, string | undefined> } }).requestInfo?.headers;
  const token = headers?.authorization?.replace(/^Bearer /, "");
  if (!token) throw new Error("unauthenticated");
  return { id: token, tenantId: "tenant-1", groups: [] };
}

export const search = async (q: { query: string; principal: Principal }): Promise<Pointer[]> => [{ ...pointer, title: `${q.principal.id}:${q.query}` }];

export async function startHttp(): Promise<RunningMcpServer & { url: URL }> {
  const server = await startMcpServer({ transport: "http", port: 0, search, principalFor });
  return { ...server, url: new URL(`http://127.0.0.1:${server.port}/mcp`) };
}

export async function httpClient(url: URL, token?: string): Promise<Client> {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const client = new Client({ name: "t", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  return client;
}

const initBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "raw", version: "1" } },
});
export type Running = Awaited<ReturnType<typeof startHttp>>;

/** Per-test-file kit: tracks servers and clients so teardown always closes them. */
export function createHttpKit() {
  const servers: Running[] = [];
  const clients: Array<{ close(): Promise<void> }> = [];
  return {
    async up() {
      const s = await startHttp();
      servers.push(s);
      return s;
    },
    async connect(s: Running, token: string) {
      const c = await httpClient(s.url, token);
      clients.push(c);
      return c;
    },
    post: (s: Running, headers: Record<string, string>, body = initBody) =>
      fetch(s.url, { method: "POST", body, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } }),
    async teardown() {
      await Promise.all(clients.splice(0).map((c) => c.close().catch(() => undefined)));
      await Promise.all(servers.splice(0).map((s) => s.close()));
    },
  };
}

export function titleOf(result: unknown): string {
  const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "{}";
  return (JSON.parse(text) as { results: Array<{ title: string }> }).results[0]?.title ?? "";
}
