import type { Pointer, Principal } from "@brain/core-types";
import { describe, expect, it, vi } from "vitest";
import type { Outcome } from "../../src/adapter.js";
import { auditedOutcome, RetrievalError } from "../../src/index.js";
import { auditKey, fakeAudit } from "../harness.js";

const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
const ask = { query: "q", limit: 5, principal: alice };
const ok: Outcome = { ok: true, pointers: [{ id: "d1" }, { id: "d2" }] as Pointer[], truncated: true, scanned: 2, liveDenied: 0, liveUnverified: 0 };

describe("auditedOutcome", () => {
  it("writes one row with the count and returns the same outcome", async () => {
    const f = fakeAudit();
    expect(await auditedOutcome(async () => ok, f.audit, auditKey)(ask)).toBe(ok);
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]?.event).toMatchObject({ actor: "alice", action: "search", detail: { count: 2 } });
  });

  it("rejects with AUDIT and returns nothing when the row cannot be written", async () => {
    const f = fakeAudit();
    f.audit.failWith = new Error("disk");
    await expect(auditedOutcome(async () => ok, f.audit, auditKey)(ask)).rejects.toMatchObject({ code: "AUDIT" });
  });

  it("leaves no row when the search itself rejects", async () => {
    const f = fakeAudit();
    await expect(
      auditedOutcome(
        vi.fn(async () => Promise.reject(new Error("x"))),
        f.audit,
        auditKey,
      )(ask),
    ).rejects.toThrow("x");
    expect(f.rows).toEqual([]);
  });

  it("requires audit and a non-empty key at construction", () => {
    const f = fakeAudit();
    expect(() => auditedOutcome(async () => ok, f.audit, "")).toThrow(RetrievalError);
    expect(() => auditedOutcome(async () => ok, undefined as never, auditKey)).toThrow(RetrievalError);
  });
});
