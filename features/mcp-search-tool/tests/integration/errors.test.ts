import type { Pointer } from "@brain/core-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connected } from "./harness.js";

const open: Array<{ close(): Promise<void> }> = [];
afterEach(async () => Promise.all(open.splice(0).map((item) => item.close())));

describe("failed search calls", () => {
  it("returns a safe MCP error when search throws", async () => {
    const pair = await connected(async () => {
      throw new Error("secret database hostname");
    });
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "fail" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Search failed");
    expect(JSON.stringify(result)).not.toContain("secret database hostname");
  });

  it("returns a safe error for malformed dependency output", async () => {
    const pair = await connected(async () => [null as unknown as Pointer]);
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "bad" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Search failed");
  });

  it("rejects invalid input before search runs", async () => {
    const search = vi.fn();
    const pair = await connected(search);
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "x".repeat(2001), limit: 0 },
    });
    expect(result.isError).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });
});
