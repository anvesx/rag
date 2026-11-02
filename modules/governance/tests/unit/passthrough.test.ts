import { describe, expect, it } from "vitest";
import { GovernanceError } from "../../src/index.js";
import { fakes } from "./helpers.js";

describe("verify and checkpoint", () => {
  it("delegates verify to audit", async () => {
    const { gov } = fakes();
    expect(await gov.verify("t1")).toEqual({ status: "ok" });
  });
  it("delegates checkpoint to audit", async () => {
    const { gov } = fakes();
    expect(await gov.checkpoint("t1")).toEqual({ seq: 7, hash: "cp" });
  });
  it("wraps verify failure in GovernanceError AUDIT", async () => {
    const { gov, audit } = fakes();
    const boom = new Error("x");
    audit.verify = async () => Promise.reject(boom);
    expect(await gov.verify("t1").catch((e) => e)).toMatchObject({ code: "AUDIT", cause: boom, message: "audit verify failed" });
  });
  it("wraps checkpoint failure in GovernanceError AUDIT", async () => {
    const { gov, audit } = fakes();
    const boom = new Error("x");
    audit.checkpoint = async () => Promise.reject(boom);
    const e = await gov.checkpoint("t1").catch((x) => x);
    expect(e).toBeInstanceOf(GovernanceError);
    expect(e).toMatchObject({ code: "AUDIT", cause: boom, message: "audit checkpoint failed" });
  });
});
