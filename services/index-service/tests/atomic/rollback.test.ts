import { describe, expect, it } from "vitest";
import { fail } from "../support/content.js";
import { seeded, setup, T, v2 } from "../support/harness.js";

describe("rollback after a failed replace", () => {
  it("rolls back exactly once", async () => {
    const env = await seeded({});
    let acls = 0;
    const index = {
      ...env.index,
      replace: () => {
        throw new Error("disk");
      },
      updateAcl: (...a: Parameters<typeof env.index.updateAcl>) => {
        acls++;
        return env.index.updateAcl(...a);
      },
    };
    await fail(setup(T, { registry: env.registry, index }).svc.apply({ type: "upsert", pointer: v2 }));
    expect(acls).toBe(1);
  });

  it("a failed replace with a failed rollback is ROLLBACK_FAILED", async () => {
    const env = await seeded({});
    const boom = () => {
      throw new Error("x");
    };
    const svc = setup(T, { registry: env.registry, index: { ...env.index, replace: boom, updateAcl: boom } }).svc;
    expect(await fail(svc.apply({ type: "upsert", pointer: v2 }))).toBe("ROLLBACK_FAILED");
  });
});
