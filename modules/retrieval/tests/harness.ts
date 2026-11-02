import type { Pointer, Principal } from "@anvesx/core-types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createSearchIndex } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import { createRetrieval, type RetrievalOptions } from "../src/index.js";

/** Bearer token "user:group1,group2" in tenant t1. Missing header is unauthenticated. */
export function principalFor(extra: unknown): Principal {
  const headers = (extra as { requestInfo?: { headers?: Record<string, string | undefined> } }).requestInfo?.headers;
  const token = headers?.authorization?.replace(/^Bearer /, "");
  if (!token) throw new Error("unauthenticated");
  const [id = "", groups = ""] = token.split(":");
  return { id, tenantId: "t1", groups: groups === "" ? [] : groups.split(",") };
}

export const auditKey = "test-master-key";

export type Row = { tenantId: string; event: { actor: string; action: string; target: string; detail?: Record<string, unknown> } };

/** Audit fake that logs rows; set `failWith` to make the write fail. */
export function fakeAudit() {
  const rows: Row[] = [];
  const audit = {
    failWith: undefined as unknown,
    async record(tenantId: string, event: Row["event"]) {
      if (this.failWith !== undefined) throw this.failWith;
      rows.push({ tenantId, event });
      return { seq: rows.length, hash: "h" };
    },
    checkpoint: async (_t: string) => ({ seq: 0, hash: "" }),
    verify: async (_t: string) => ({ status: "ok" as const }) as { status: "ok" },
  };
  return { rows, audit };
}

export function rig(overrides: Partial<RetrievalOptions> = {}) {
  const { rows, audit } = fakeAudit();
  const index = createSearchIndex(":memory:", 2);
  const registry = createRegistry(":memory:");
  const seed = (id: string, users: string[] = [], groups: string[] = [], tenantId = "t1") => {
    const acl = { allowUsers: users, allowGroups: groups, version: 1 };
    index.add({ chunkId: `${id}-c1`, docId: id, tenantId, text: "needle", embedding: [1, 0], acl });
    const pointer: Pointer = {
      id,
      tenantId,
      source: "s",
      address: `s://${id}`,
      title: id,
      version: "v1",
      contentHash: "a".repeat(64),
      zone: "team",
      acl,
      updatedAt: "2026-11-01T00:00:00Z",
      deletedAt: null,
    };
    registry.upsert(pointer);
  };
  const start = (extra: Partial<RetrievalOptions> = {}) =>
    createRetrieval({ index, registry, audit, auditKey, principalFor, embedQuery: async () => [1, 0], transport: "http", port: 0, ...overrides, ...extra });
  return { index, registry, seed, start, rows, audit };
}

export const urlOf = (port: number | undefined) => new URL(`http://127.0.0.1:${port}/mcp`);

export async function connect(port: number | undefined, token?: string): Promise<Client> {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const client = new Client({ name: "t", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(urlOf(port), { requestInit: { headers } }));
  return client;
}

export type ToolResult = { isError?: boolean; content: Array<{ text: string }> };
export const idsOf = (r: unknown): string[] =>
  (JSON.parse((r as ToolResult).content[0]?.text ?? "{}") as { results: Array<{ id: string }> }).results.map((p) => p.id);
