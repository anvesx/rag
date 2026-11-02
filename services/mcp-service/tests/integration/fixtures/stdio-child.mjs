import { startMcpServer } from "../../../dist/index.js";

const pointer = {
  id: "p-1",
  tenantId: "tenant-1",
  source: "drive",
  address: "drive://doc/1",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

await startMcpServer({
  transport: "stdio",
  search: async ({ query, principal }) => [{ ...pointer, title: `${principal.id}:${query}` }],
  principalFor: () => ({ id: process.env.TEST_PRINCIPAL ?? "stdio-user", tenantId: "tenant-1", groups: [] }),
});
