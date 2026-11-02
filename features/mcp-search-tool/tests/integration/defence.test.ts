import type { Pointer } from "@brain/core-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connected, principal } from "./harness.js";

const base: Pointer = {
  id: "ok",
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

async function call(search: () => Promise<Pointer[]>, logger?: (cause: unknown) => void) {
  const pair = await connected(search, () => principal, logger);
  open.push(pair.client, pair.server);
  return pair.client.callTool({ name: "search", arguments: { query: "q" } });
}

async function ids(pointers: Pointer[]): Promise<string[]> {
  const result = await call(async () => pointers);
  const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
  return (JSON.parse(text) as { results: Array<{ id: string }> }).results.map((r) => r.id);
}

describe("defence in depth", () => {
  it("drops tombstoned pointers", async () => {
    const dead = { ...base, id: "dead", deletedAt: "2026-02-01T00:00:00.000Z" };
    expect(await ids([base, dead])).toEqual(["ok"]);
  });
  it("drops pointers of another tenant", async () => {
    expect(await ids([{ ...base, id: "other", tenantId: "tenant-2" }, base])).toEqual(["ok"]);
  });
  it("returns an empty result when everything is filtered", async () => {
    expect(await ids([{ ...base, tenantId: "x" }])).toEqual([]);
  });
});

describe("error logging", () => {
  it("passes the cause to the injected logger without leaking it to the caller", async () => {
    const cause = new Error("secret database hostname");
    const logger = vi.fn();
    const result = await call(async () => {
      throw cause;
    }, logger);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toBe(cause);
  });
  it("still returns a safe error when the logger itself throws", async () => {
    const result = await call(
      async () => {
        throw new Error("x");
      },
      () => {
        throw new Error("logger down");
      },
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Search failed");
  });
  it("works without a logger", async () => {
    const result = await call(async () => {
      throw new Error("x");
    });
    expect(result.isError).toBe(true);
  });
});
