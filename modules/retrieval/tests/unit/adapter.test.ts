import type { Principal } from "@brain/core-types";
import { QueryError, type SearchResult } from "@rag/query-service";
import { describe, expect, it, vi } from "vitest";
import { toOutcomeFn, toSearchFn } from "../../src/adapter.js";
import { RetrievalError } from "../../src/index.js";

const principal: Principal = { id: "alice", tenantId: "t1", groups: [] };
const result = (over: Partial<SearchResult> = {}): SearchResult => ({
  pointers: [{ id: "x" }] as never,
  truncated: false,
  scanned: 1,
  liveDenied: 0,
  liveUnverified: 0,
  ...over,
});
const make = (searchLive = vi.fn(async () => result()), embedQuery = vi.fn(async (_t: string) => [1, 0])) => ({
  searchLive,
  embedQuery,
  fn: toOutcomeFn({ searchLive }, embedQuery),
});
const ask = { query: "hello", limit: 7, principal };

describe("toOutcomeFn", () => {
  it("embeds the query and forwards query, principal, limit and embedding to searchLive", async () => {
    const m = make();
    await m.fn(ask);
    expect(m.embedQuery).toHaveBeenCalledWith("hello");
    expect(m.searchLive).toHaveBeenCalledWith({ query: "hello", principal, limit: 7, embedding: [1, 0] });
  });

  it("accepts a synchronous embedQuery", async () => {
    const m = make(undefined, vi.fn(() => [0, 1]) as never);
    await m.fn(ask);
    expect(m.searchLive).toHaveBeenCalledWith(expect.objectContaining({ embedding: [0, 1] }));
  });

  it("returns ok with the pointers and the truncated and live counters", async () => {
    const full = result({ truncated: true, scanned: 1000, liveDenied: 2, liveUnverified: 3 });
    await expect(make(vi.fn(async () => full)).fn(ask)).resolves.toEqual({ ok: true, degraded: true, ...full });
  });

  it("fails closed with LIVE_ACL when nothing was returned and something was unverified", async () => {
    await expect(make(vi.fn(async () => result({ pointers: [], liveUnverified: 2 }))).fn(ask)).resolves.toEqual({ ok: false, code: "LIVE_ACL" });
  });

  it("treats all-denied or no-match as an ordinary empty result", async () => {
    const denied = make(vi.fn(async () => result({ pointers: [], liveDenied: 2 })));
    await expect(denied.fn(ask)).resolves.toMatchObject({ ok: true, pointers: [] });
    await expect(make(vi.fn(async () => result({ pointers: [] }))).fn(ask)).resolves.toMatchObject({ ok: true });
  });

  it("keeps partial results when some hits were unverified", async () => {
    await expect(make(vi.fn(async () => result({ liveUnverified: 4 }))).fn(ask)).resolves.toMatchObject({ ok: true, liveUnverified: 4 });
  });

  it("maps a service LIVE_ACL error to the typed failure", async () => {
    await expect(make(vi.fn(async () => Promise.reject(new QueryError("LIVE_ACL")))).fn(ask)).resolves.toEqual({ ok: false, code: "LIVE_ACL" });
  });

  it("rejects other query errors and embed failures, without searching on an embed failure", async () => {
    await expect(make(vi.fn(async () => Promise.reject(new QueryError("BACKEND")))).fn(ask)).rejects.toMatchObject({ code: "BACKEND" });
    const fail = vi.fn(async (_t: string): Promise<number[]> => Promise.reject(new Error("down")));
    const m = make(undefined, fail);
    await expect(m.fn(ask)).rejects.toThrow("down");
    expect(m.searchLive).not.toHaveBeenCalled();
  });
});

describe("toSearchFn", () => {
  it("returns the pointers of an ok outcome", async () => {
    const full = result();
    await expect(toSearchFn(async () => ({ ok: true, ...full }))(ask)).resolves.toBe(full.pointers);
  });

  it("rejects with a typed LIVE_ACL RetrievalError on a failed outcome", async () => {
    const error = await toSearchFn(async () => ({ ok: false, code: "LIVE_ACL" }))(ask).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RetrievalError);
    expect(error).toMatchObject({ code: "LIVE_ACL" });
  });
});
