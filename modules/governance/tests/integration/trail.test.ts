import { describe, expect, it } from "vitest";
import { createGovernance } from "../../src/index.js";
import { rig, who } from "./rig.js";

describe("audit trail over real audit and query services", () => {
  it("every search leaves one verifiable row with a hashed target", async () => {
    const { gov, chain, go } = rig();
    expect((await go(who("alice"))).map((p) => p.id)).toEqual(["t1-d"]);
    await go(who("alice"));
    const rows = chain.list("t1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ actor: "alice", action: "search", detail: { count: 1 } });
    expect(rows[0]?.target).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain("needle");
    expect(await gov.verify("t1")).toEqual({ status: "ok" });
  });
  it("keeps tenants in separate chains", async () => {
    const { chain, go } = rig();
    await go(who("alice"));
    await go(who("zed", "t2"));
    expect(chain.list("t1")).toHaveLength(1);
    expect(chain.list("t2")).toHaveLength(1);
  });
  it("blocks results when the audit store fails", async () => {
    const { query, go } = rig();
    const audit = {
      record: async () => Promise.reject(new Error("down")),
      verify: async () => ({ status: "ok" as const }),
      checkpoint: async () => ({ seq: 0, hash: "" }),
    };
    const broken = createGovernance({ audit, query, auditKey: "k" });
    await expect(broken.search({ query: "needle", principal: who("alice"), embedding: [1, 0] })).rejects.toMatchObject({ code: "AUDIT" });
    expect((await go(who("alice"))).length).toBe(1);
  });
  it("records nothing when the search itself is invalid", async () => {
    const { chain, go } = rig();
    await expect(go(who("alice"), "   ")).rejects.toMatchObject({ code: "EMPTY_QUERY" });
    expect(chain.list("t1")).toHaveLength(0);
  });
});
