import type { Pointer, Principal } from "@anvesx/core-types";
import type { SearchResult } from "@rag/query-service";
import { describe, expect, it, vi } from "vitest";
import { type Outcome, toOutcomeFn } from "../../src/adapter.js";
import { auditedOutcome } from "../../src/index.js";
import { auditKey, fakeAudit } from "../harness.js";

const principal: Principal = { id: "alice", tenantId: "t1", groups: [] };
const result = (over: Partial<SearchResult> = {}): SearchResult => ({
  pointers: [{ id: "x" }] as Pointer[],
  truncated: false,
  scanned: 1,
  liveDenied: 0,
  liveUnverified: 0,
  ...over,
});
const ask = { query: "  hello  ", limit: 5, principal };

describe("degraded outcome", () => {
  it("flags ok results that survived with unverified hits, and only those", async () => {
    const run = (r: SearchResult) => toOutcomeFn({ searchLive: async () => r }, () => [1, 0])(ask);
    expect(await run(result({ liveUnverified: 2 }))).toMatchObject({ ok: true, degraded: true });
    expect(await run(result())).not.toHaveProperty("degraded");
  });
});

describe("query validation before embedding", () => {
  it("embeds and searches the trimmed query", async () => {
    const embed = vi.fn(() => [1, 0]);
    const searchLive = vi.fn(async () => result());
    await toOutcomeFn({ searchLive }, embed)(ask);
    expect(embed).toHaveBeenCalledWith("hello");
    expect(searchLive).toHaveBeenCalledWith(expect.objectContaining({ query: "hello" }));
  });

  it("rejects empty queries, bad principals and bad limits without embedding", async () => {
    const embed = vi.fn(() => [1, 0]);
    const fn = toOutcomeFn({ searchLive: async () => result() }, embed);
    await expect(fn({ ...ask, query: "   " })).rejects.toMatchObject({ code: "EMPTY_QUERY" });
    await expect(fn({ ...ask, principal: {} as Principal })).rejects.toMatchObject({ code: "PRINCIPAL" });
    await expect(fn({ ...ask, limit: 0 })).rejects.toMatchObject({ code: "LIMIT" });
    expect(embed).not.toHaveBeenCalled();
  });
});

describe("LIVE_ACL audit", () => {
  const failed: Outcome = { ok: false, code: "LIVE_ACL" };

  it("writes one failure row with zero results and returns the failure", async () => {
    const f = fakeAudit();
    expect(await auditedOutcome(async () => failed, f.audit, auditKey)(ask)).toBe(failed);
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]?.event).toMatchObject({ actor: "alice", action: "search", detail: { count: 0, outcome: "failure", code: "LIVE_ACL" } });
  });

  it("still fails the request with AUDIT when that row cannot be written", async () => {
    const f = fakeAudit();
    f.audit.failWith = new Error("disk");
    await expect(auditedOutcome(async () => failed, f.audit, auditKey)(ask)).rejects.toMatchObject({ code: "AUDIT" });
  });
});
