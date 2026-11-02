import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createAuditChain } from "@rag/audit-chain";
import { createAuditService, createFileAnchorStore } from "@rag/audit-service";
import { createSearchIndex } from "@rag/hybrid-search";
import { createRegistry } from "@rag/pointer-registry";
import { createRetrieval } from "@rag/retrieval";
import { afterEach, describe, expect, it } from "vitest";
import { scratch } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);

const bearer = (extra: unknown) => {
  const auth = (extra as { requestInfo?: { headers?: Record<string, string> } }).requestInfo?.headers?.authorization;
  if (!auth) throw new Error("unauthenticated");
  return { id: auth.replace("Bearer ", ""), tenantId: "t1", groups: [] };
};

describe("retrieval over MCP", () => {
  it("writes one verifiable audit row per search and rejects unauthenticated calls", async () => {
    const dir = tmp.make();
    const registry = createRegistry(`${dir}/r.db`);
    const audit = createAuditService({
      chain: createAuditChain(`${dir}/a.db`),
      anchorStore: createFileAnchorStore(`${dir}/anchors.log`),
      clock: () => new Date(1000),
    });
    const retrieval = await createRetrieval({
      index: createSearchIndex(`${dir}/s.db`, 2),
      registry,
      audit,
      auditKey: "k",
      embedQuery: () => [1, 0],
      transport: "http",
      port: 0,
      principalFor: bearer,
    });
    const url = new URL(`http://127.0.0.1:${retrieval.port}/mcp`);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: "Bearer alice" } } }));
    for (let i = 0; i < 3; i++) await client.callTool({ name: "search", arguments: { query: `q${i}` } });
    expect(await audit.verify("t1")).toEqual({ status: "ok" });
    await client.close();
    await expect(new Client({ name: "t", version: "1" }).connect(new StreamableHTTPClientTransport(url))).rejects.toThrow();
    await retrieval.close();
    registry.close();
  });
});
