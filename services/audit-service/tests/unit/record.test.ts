import { createAuditChain } from "@rag/audit-chain";
import { describe, expect, it } from "vitest";
import { createAuditService } from "../../src/index.js";
import { ev, make, memStore } from "./helpers.js";

describe("record", () => {
  it("stamps at from the injected clock and returns seq+hash", async () => {
    const { svc, chain } = make();
    const r = await svc.record("t", ev());
    expect(r.seq).toBe(1);
    expect(chain.list("t")[0]?.at).toBe("2026-02-03T04:05:06.000Z");
    expect(r.hash).toBe(chain.head("t").hash);
  });
  it("record + verify with no anchor is ok", async () => {
    const { svc } = make();
    await svc.record("t", ev());
    expect(await svc.verify("t")).toEqual({ status: "ok" });
  });
  it("rejects an invalid clock date with CLOCK", async () => {
    const chain = createAuditChain(":memory:");
    const svc = createAuditService({ chain, anchorStore: memStore(), clock: () => new Date("x") });
    await expect(svc.record("t", ev())).rejects.toMatchObject({ code: "CLOCK" });
  });
  it("passes chain validation errors through", async () => {
    const { svc } = make();
    await expect(svc.record("t", { ...ev(), actor: "" })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("concurrent records keep call order with no gaps", async () => {
    const { svc, chain } = make();
    await Promise.all(Array.from({ length: 50 }, (_, i) => svc.record("t", ev(i))));
    expect(chain.list("t", 0, 100).map((e) => e.target)).toEqual(Array.from({ length: 50 }, (_, i) => `doc/${i}`));
    expect(await svc.verify("t")).toEqual({ status: "ok" });
  });
});
