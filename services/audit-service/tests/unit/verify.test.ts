import { createAuditChain } from "@rag/audit-chain";
import { describe, expect, it } from "vitest";
import { AnchorStoreError, createAuditService } from "../../src/index.js";
import { clock, ev, make, memStore } from "./helpers.js";

const F = "f".repeat(64);
describe("verify", () => {
  it("is ok with an older anchor", async () => {
    const { svc } = make();
    await svc.record("t", ev(1));
    await svc.checkpoint("t");
    await svc.record("t", ev(2));
    expect(await svc.verify("t")).toEqual({ status: "ok" });
  });
  it("reports truncated when the anchor is ahead of the chain", async () => {
    const { svc, store } = make();
    await svc.record("t", ev());
    store.rows.push({ tenantId: "t", seq: 3, hash: F, at: "x" });
    expect(await svc.verify("t")).toEqual({ status: "truncated", brokenAt: 2 });
  });
  it("reports mismatch when the anchored hash differs", async () => {
    const { svc, store } = make();
    await svc.record("t", ev());
    store.rows.push({ tenantId: "t", seq: 1, hash: F, at: "x" });
    expect(await svc.verify("t")).toEqual({ status: "mismatch", brokenAt: 1 });
  });
  it("reports mismatch for an internally broken chain", async () => {
    const chain = { ...createAuditChain(":memory:"), verify: () => ({ ok: false as const, brokenAt: 4 }) };
    const svc = createAuditService({ chain, anchorStore: memStore(), clock });
    expect(await svc.verify("t")).toEqual({ status: "mismatch", brokenAt: 4 });
  });
  it("wraps store read failure", async () => {
    const store = { ...memStore(), latest: async () => Promise.reject(new Error("io")) };
    const svc = createAuditService({ chain: createAuditChain(":memory:"), anchorStore: store, clock });
    await expect(svc.verify("t")).rejects.toBeInstanceOf(AnchorStoreError);
  });
  it("tenants are independent", async () => {
    const { svc, store } = make();
    await svc.record("a", ev());
    await svc.record("b", ev());
    await svc.checkpoint("a");
    store.rows.push({ tenantId: "b", seq: 9, hash: F, at: "x" });
    expect(await svc.verify("a")).toEqual({ status: "ok" });
    expect((await svc.verify("b")).status).toBe("truncated");
    expect((await svc.checkpoint("a")).seq).toBe(1);
  });
});
