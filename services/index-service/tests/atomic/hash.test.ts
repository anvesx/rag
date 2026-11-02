import { describe, expect, it } from "vitest";
import { fail } from "../support/content.js";
import { A, B, HB, pointer, seeded, setup, T } from "../support/harness.js";

/** The source changed between list (pointer says hash of A or B) and fetch (returns other text). */
const drifted = { "acme/d1@v1": B, "acme/d1@v2": A };

describe("fetched text is verified against pointer.contentHash", () => {
  it("rejects a drifted body for a new doc before embed or any index write", async () => {
    const env = setup(drifted);
    const writes: string[] = [];
    const index = { ...env.index, add: () => writes.push("add"), replace: () => writes.push("replace"), remove: () => writes.push("remove") };
    const svc = setup(drifted, { registry: env.registry, index: index as never }).svc;
    expect(await fail(svc.apply({ type: "upsert", pointer: pointer() }))).toBe("HASH_MISMATCH");
    expect(writes).toEqual([]);
    expect(env.calls.embed).toBe(0);
    expect(env.registry.get("acme", "d1")?.deletedAt).not.toBeNull();
    expect(env.count("acme")).toBe(0);
  });

  it("on an update it keeps the old chunks and restores the old pointer", async () => {
    const env = await seeded({ fetchText: async () => A });
    const pointerV2 = pointer({ version: "v2", contentHash: HB });
    expect(await fail(env.svc.apply({ type: "upsert", pointer: pointerV2 }))).toBe("HASH_MISMATCH");
    expect(env.registry.get("acme", "d1")?.version).toBe("v1");
    expect(env.has("acme", "d1", A)).toBe(true);
    expect(env.has("acme", "d1", B)).toBe(false);
  });

  it("an ACL widened between list and fetch never reaches the index", async () => {
    const env = await seeded({ fetchText: async () => A });
    const wide = { allowUsers: ["u1", "u2"], allowGroups: [], version: 2 };
    await fail(env.svc.apply({ type: "upsert", pointer: pointer({ version: "v2", contentHash: HB, acl: wide }) }));
    expect(env.registry.get("acme", "d1")?.acl.allowUsers).toEqual(["u1"]);
    expect(env.has("acme", "d1", A, "u2")).toBe(false);
  });

  it("carries the cause detail and replays once the source is consistent", async () => {
    const env = await seeded({ fetchText: async () => A });
    const pointerV2 = pointer({ version: "v2", contentHash: HB });
    await fail(env.svc.apply({ type: "upsert", pointer: pointerV2 }));
    const ok = setup(T, { registry: env.registry, index: env.index });
    expect((await ok.svc.apply({ type: "upsert", pointer: pointerV2 })).outcome).toBe("updated");
    expect(env.has("acme", "d1", B)).toBe(true);
  });

  it("an empty body is hashed too", async () => {
    const env = setup({ "acme/d1@v1": "" });
    expect(await fail(env.svc.apply({ type: "upsert", pointer: pointer() }))).toBe("HASH_MISMATCH");
  });
});
