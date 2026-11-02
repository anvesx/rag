import { createHmac } from "node:crypto";
import type { Pointer, Principal } from "@anvesx/core-types";
import { describe, expect, it, vi } from "vitest";
import { auditedSearch, RetrievalError } from "../../src/index.js";
import { auditKey, fakeAudit } from "../harness.js";

const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
const hits = [{ id: "d1" }, { id: "d2" }] as Pointer[];
const make = (key: string | Uint8Array = auditKey, search = vi.fn(async () => hits)) => {
  const f = fakeAudit();
  return { ...f, search, run: auditedSearch(search, f.audit, key) };
};
const q = (query: string, principal = alice) => ({ query, limit: 5, principal });
const expected = (tenantId: string, query: string) => {
  const tenantKey = createHmac("sha256", auditKey).update(`rag-audit-target-key:${tenantId}`).digest();
  return createHmac("sha256", tenantKey).update(query.trim(), "utf8").digest("hex");
};
describe("auditedSearch", () => {
  it("records one keyed row with actor, action, count and returns the results", async () => {
    const m = make();
    expect(await m.run(q("  secret roadmap "))).toBe(hits);
    expect(m.rows).toEqual([{ tenantId: "t1", event: { actor: "alice", action: "search", target: expected("t1", "secret roadmap"), detail: { count: 2 } } }]);
  });
  it("writes the row before returning results", async () => {
    const order: string[] = [];
    const m = make(
      auditKey,
      vi.fn(async () => {
        order.push("search");
        return hits;
      }),
    );
    const record = m.audit.record.bind(m.audit);
    m.audit.record = async (t, e) => {
      order.push("record");
      return record(t, e);
    };
    await m.run(q("x"));
    expect(order).toEqual(["search", "record"]);
  });
  it("same query and tenant give the same digest; other tenant differs", async () => {
    const m = make();
    await m.run(q("a"));
    await m.run(q("a"));
    await m.run(q("a", { ...alice, tenantId: "t2" }));
    expect(m.rows[0]?.event.target).toBe(m.rows[1]?.event.target);
    expect(m.rows[2]?.event.target).not.toBe(m.rows[0]?.event.target);
  });
  it("stores no raw query text", async () => {
    const m = make();
    await m.run(q("quarterly layoffs plan"));
    expect(JSON.stringify(m.rows)).not.toMatch(/quarterly|layoffs/);
  });
  it("fails closed: audit failure rejects with RetrievalError AUDIT and no results", async () => {
    const m = make();
    const boom = new Error("disk full");
    m.audit.failWith = boom;
    const e = await m.run(q("x")).catch((x) => x);
    expect(e).toBeInstanceOf(RetrievalError);
    expect(e).toMatchObject({ code: "AUDIT", cause: boom, name: "RetrievalError", message: "audit record failed" });
  });
  it("search errors pass through and leave no row", async () => {
    const bad = new Error("EMPTY_QUERY");
    const m = make(
      auditKey,
      vi.fn(async () => Promise.reject(bad)),
    );
    await expect(m.run(q(""))).rejects.toBe(bad);
    expect(m.rows).toHaveLength(0);
  });
  it.each([undefined, "", new Uint8Array()])("refuses to build without a key (%s)", (key) => {
    const make2 = () => auditedSearch(async () => hits, fakeAudit().audit, key as never);
    expect(make2).toThrow(expect.objectContaining({ code: "CONFIG", message: "auditKey is required" }));
  });
  it("refuses to build without an audit service", () => {
    const make2 = () => auditedSearch(async () => hits, undefined as never, auditKey);
    expect(make2).toThrow(expect.objectContaining({ code: "CONFIG", message: "audit is required" }));
  });
});
