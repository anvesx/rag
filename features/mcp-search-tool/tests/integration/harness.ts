import type { Principal } from "@brain/core-types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchTool, type SearchFn } from "../../src/index.js";

export const principal: Principal = {
  id: "user-1",
  tenantId: "tenant-1",
  groups: ["engineering"],
};

export async function connected(search: SearchFn, principalFor: (extra: unknown) => Principal = () => principal, logger?: (cause: unknown) => void) {
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  registerSearchTool(server, { search, principalFor, logger });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}
