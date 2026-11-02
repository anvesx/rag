import type { Pointer } from "@anvesx/core-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connected, principal } from "./harness.js";

const pointer: Pointer = {
  id: "p-1",
  tenantId: "tenant-1",
  source: "drive",
  address: "drive://doc/1",
  title: "Plan",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

const open: Array<{ close(): Promise<void> }> = [];
afterEach(async () => Promise.all(open.splice(0).map((item) => item.close())));

describe("successful search calls", () => {
  it("lists and calls search with an injected principal", async () => {
    const search = vi.fn().mockResolvedValue([pointer]);
    const pair = await connected(search);
    open.push(pair.client, pair.server);
    const tools = (await pair.client.listTools()).tools;
    expect(tools.map(({ name }) => name)).toEqual(["search"]);
    expect(tools[0]?.description).toContain("knowledge pointers");
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "plan" },
    });
    expect(search).toHaveBeenCalledWith({
      query: "plan",
      limit: 10,
      principal,
    });
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          results: [
            {
              id: "p-1",
              source: "drive",
              address: "drive://doc/1",
              title: "Plan",
              version: "v1",
              zone: "team",
            },
          ],
        }),
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("contentHash");
  });

  it("returns an empty result", async () => {
    const pair = await connected(async () => []);
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "none", limit: 1 },
    });
    expect(result.content).toEqual([{ type: "text", text: '{"results":[]}' }]);
  });
});
