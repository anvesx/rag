import { describe, expect, it } from "vitest";
import { IndexServiceError } from "../../src/index.js";
import { A, B, boom, embedText, pointer, seeded, setup, T, v2 } from "../support/harness.js";

async function expectIntact(env: Awaited<ReturnType<typeof seeded>>, code: string) {
  await expect(env.svc.apply({ type: "upsert", pointer: v2 })).rejects.toMatchObject({ code });
  expect(env.registry.get("acme", "d1")?.version).toBe("v1");
  expect(env.has("acme", "d1", A)).toBe(true);
  expect(env.has("acme", "d1", B)).toBe(false);
}

describe("partial failure keeps old chunks", () => {
  it("fetch failure", async () => {
    await expectIntact(await seeded({ fetchText: boom }), "FETCH_FAILED");
  });

  it("chunk failure", async () => {
    await expectIntact(await seeded({ chunk: boom }), "CHUNK_FAILED");
  });

  it("embed failure", async () => {
    await expectIntact(await seeded({ embed: boom }), "EMBED_FAILED");
  });

  it("embed returns wrong count", async () => {
    await expectIntact(await seeded({ embed: async () => [] }), "EMBED_INVALID");
  });

  it("embed returns wrong dimension for the index", async () => {
    await expectIntact(await seeded({ embed: async (t) => t.map(() => [1, 2]) }), "EMBED_INVALID");
  });

  it("after a failed update, replaying succeeds", async () => {
    const env = await seeded({ embed: boom });
    await expect(env.svc.apply({ type: "upsert", pointer: v2 })).rejects.toBeInstanceOf(IndexServiceError);
    const ok = setup(T, { registry: env.registry, index: env.index });
    expect((await ok.svc.apply({ type: "upsert", pointer: v2 })).outcome).toBe("updated");
    expect(env.has("acme", "d1", B)).toBe(true);
  });

  it("failed create leaves no pointer and no chunks; replay indexes", async () => {
    const env = setup(T, { embed: boom });
    await expect(env.svc.apply({ type: "upsert", pointer: pointer() })).rejects.toMatchObject({
      code: "EMBED_FAILED",
    });
    expect(env.registry.get("acme", "d1")).toBeUndefined();
    const ok = setup(T, { registry: env.registry, index: env.index, embed: async (t) => t.map(embedText) });
    expect((await ok.svc.apply({ type: "upsert", pointer: pointer() })).outcome).toBe("updated");
    expect(env.has("acme", "d1", A)).toBe(true);
  });

  it("fetch failure on a narrowing ACL change keeps the new ACL applied: no resurrection", async () => {
    const env = await seeded({ fetchText: boom });
    const narrow = pointer({ ...v2, acl: { allowUsers: [], allowGroups: [], version: 2 } });
    await expect(env.svc.apply({ type: "upsert", pointer: narrow })).rejects.toMatchObject({ code: "FETCH_FAILED" });
    expect(env.has("acme", "d1", A, "u1")).toBe(false);
    expect(env.registry.get("acme", "d1")?.acl.allowUsers).toEqual([]);
  });

  it("a failed update never widens access: the stale chunks keep the intersection of old and new ACL", async () => {
    const env = await seeded({ fetchText: boom });
    const wide = pointer({ ...v2, acl: { allowUsers: ["u1", "u2"], allowGroups: ["g"], version: 2 } });
    await expect(env.svc.apply({ type: "upsert", pointer: wide })).rejects.toMatchObject({ code: "FETCH_FAILED" });
    expect(env.has("acme", "d1", A, "u1")).toBe(true);
    expect(env.has("acme", "d1", A, "u2")).toBe(false);
    expect(env.registry.get("acme", "d1")?.acl).toMatchObject({ allowUsers: ["u1"], allowGroups: [] });
  });
});
