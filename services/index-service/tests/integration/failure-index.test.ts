import { describe, expect, it } from "vitest";
import { A, boom, seeded, setup, T, v2 } from "../support/harness.js";

describe("index and event failures", () => {
  it("index replace failure restores the old pointer, chunks intact", async () => {
    const env = await seeded({});
    const bad = {
      ...env.index,
      replace: () => {
        throw new Error("disk");
      },
    };
    const svc = setup(T, { registry: env.registry, index: bad }).svc;
    await expect(svc.apply({ type: "upsert", pointer: v2 })).rejects.toMatchObject({ code: "INDEX_FAILED" });
    expect(env.registry.get("acme", "d1")?.version).toBe("v1");
    expect(env.has("acme", "d1", A)).toBe(true);
  });

  it("failed rollback is reported as ROLLBACK_FAILED", async () => {
    const env = await seeded({});
    let n = 0;
    const registry = {
      ...env.registry,
      get: env.registry.get,
      upsert: (p: Parameters<typeof env.registry.upsert>[0]) => {
        if (++n > 1) throw new Error("db gone");
        return env.registry.upsert(p);
      },
    };
    const svc = setup(T, { registry, index: env.index, embed: boom }).svc;
    await expect(svc.apply({ type: "upsert", pointer: v2 })).rejects.toMatchObject({
      code: "ROLLBACK_FAILED",
    });
  });

  it("invalid events throw INVALID_EVENT", async () => {
    const { svc } = setup(T);
    const bad = [
      null,
      { type: "nope" },
      { type: "upsert", pointer: { id: "x" } },
      { type: "upsert" },
      { type: "delete", tenantId: "", id: "d", at: "x" },
      { type: "delete", tenantId: "acme", id: "d", at: "not-a-date" },
    ];
    for (const e of bad) await expect(svc.apply(e as never)).rejects.toMatchObject({ code: "INVALID_EVENT" });
  });
});
