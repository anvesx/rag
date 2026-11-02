import { afterEach, describe, expect, it, vi } from "vitest";
import { connected, principal } from "./harness.js";

const open: Array<{ close(): Promise<void> }> = [];
afterEach(async () => Promise.all(open.splice(0).map((item) => item.close())));

describe("principal source", () => {
  it("derives the principal from principalFor, passing request extra", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const principalFor = vi.fn().mockReturnValue(principal);
    const pair = await connected(search, principalFor);
    open.push(pair.client, pair.server);
    await pair.client.callTool({ name: "search", arguments: { query: "q" } });
    expect(principalFor).toHaveBeenCalledTimes(1);
    const extra = principalFor.mock.calls[0]?.[0] as { signal?: unknown };
    expect(extra.signal).toBeInstanceOf(AbortSignal);
    expect(search.mock.calls[0]?.[0].principal).toBe(principal);
  });

  it("rejects a principal supplied in tool input", async () => {
    const search = vi.fn();
    const pair = await connected(search);
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: {
        query: "q",
        principal: { id: "evil", tenantId: "t", groups: [] },
      },
    });
    expect(result.isError).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  it("returns a safe error and skips search when principalFor throws", async () => {
    const search = vi.fn();
    const pair = await connected(search, () => {
      throw new Error("no session");
    });
    open.push(pair.client, pair.server);
    const result = await pair.client.callTool({
      name: "search",
      arguments: { query: "q" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("no session");
    expect(search).not.toHaveBeenCalled();
  });
});
