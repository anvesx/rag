import { createAuditChain } from "@rag/audit-chain";
import { describe, expect, it } from "vitest";
import { AnchorStoreError, createAuditService } from "../../src/index.js";
import { clock, ev, make, memStore } from "./helpers.js";

describe("checkpoint", () => {
  it("writes head, tenant and time to the store", async () => {
    const { svc, store } = make();
    await svc.record("t", ev());
    const a = await svc.checkpoint("t");
    expect(a).toEqual({ seq: 1, hash: expect.any(String) });
    expect(store.rows).toEqual([{ tenantId: "t", seq: 1, hash: a.hash, at: "2026-02-03T04:05:06.000Z" }]);
  });
  it("checkpoints an empty chain at seq 0", async () => {
    const { svc } = make();
    expect((await svc.checkpoint("t")).seq).toBe(0);
  });
  it("wraps store failure in AnchorStoreError with cause", async () => {
    const boom = new Error("disk");
    const store = { ...memStore(), append: async () => Promise.reject(boom) };
    const svc = createAuditService({ chain: createAuditChain(":memory:"), anchorStore: store, clock });
    const e = await svc.checkpoint("t").catch((x) => x);
    expect(e).toBeInstanceOf(AnchorStoreError);
    expect(e).toMatchObject({ code: "ANCHOR_STORE", cause: boom });
  });
});
