import { describe, expect, it } from "vitest";
import { boom, pointer, seeded, setup, sha, T, v2 } from "../support/harness.js";

const fail = (m: string) => () => {
  throw new Error(m);
};
const long = Array.from({ length: 12 }, (_, i) => `word${i}`).join(" ");

describe("failures that must not be rolled back twice", () => {
  it("ROLLBACK_FAILED is passed through without a second rollback attempt", async () => {
    const env = await seeded({});
    let rollbacks = 0;
    const updateAcl = () => {
      rollbacks++;
      throw new Error("acl write");
    };
    const index = { ...env.index, replace: fail("disk"), updateAcl };
    const err = await setup(T, { registry: env.registry, index })
      .svc.apply({ type: "upsert", pointer: v2 })
      .catch((e) => e);
    expect(err.code).toBe("ROLLBACK_FAILED");
    expect(rollbacks).toBe(1);
  });
});

describe("restored pointer after a failed update", () => {
  it("keeps the higher ACL version of the old and incoming ACL", async () => {
    const env = await seeded({ embed: boom });
    const next = pointer({ ...v2, acl: { allowUsers: ["u1"], allowGroups: [], version: 5 } });
    await expect(env.svc.apply({ type: "upsert", pointer: next })).rejects.toMatchObject({ code: "EMBED_FAILED" });
    expect(env.registry.get("acme", "d1")?.acl.version).toBe(5);
  });
});

describe("prepare validation", () => {
  it("rejects a batch where only some vectors are valid", async () => {
    const env = setup({ "acme/d1@v1": long }, { embed: async (ts) => ts.map((_, i) => (i === 0 ? [1, 1, 1] : [Number.NaN, 1, 1])) });
    await expect(env.svc.apply({ type: "upsert", pointer: pointer({ contentHash: sha(long) }) })).rejects.toMatchObject({ code: "EMBED_INVALID" });
  });

  it("explains a non-string fetchText result", async () => {
    const env = setup(T, { fetchText: async () => 42 as never });
    const err = await env.svc.apply({ type: "upsert", pointer: pointer() }).catch((e) => e);
    expect(err.code).toBe("FETCH_FAILED");
    expect(err.cause.message).toBe("fetchText must return a string");
  });
});
