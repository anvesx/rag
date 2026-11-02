import { describe, expect, it } from "vitest";
import { rig, who } from "./rig.js";

describe("tamper detection through governance", () => {
  it("detects an edited audit row", async () => {
    const { gov, go, raw } = rig();
    await go(who("alice"));
    await go(who("alice"));
    raw("UPDATE audit SET actor = 'evil' WHERE seq = 1");
    expect(await gov.verify("t1")).toEqual({ status: "mismatch", brokenAt: 1 });
  });
  it("detects truncation after a checkpoint", async () => {
    const { gov, go, raw } = rig();
    await go(who("alice"));
    await go(who("alice"));
    await gov.checkpoint("t1");
    raw("DELETE FROM audit WHERE seq = 2");
    expect(await gov.verify("t1")).toEqual({ status: "truncated", brokenAt: 2 });
  });
  it("tampering with one tenant leaves the other verifiable", async () => {
    const { gov, go, raw } = rig();
    await go(who("alice"));
    await go(who("zed", "t2"));
    raw("UPDATE audit SET actor = 'evil' WHERE tenant_id = 't1'");
    expect(await gov.verify("t1")).toMatchObject({ status: "mismatch" });
    expect(await gov.verify("t2")).toEqual({ status: "ok" });
  });
});
