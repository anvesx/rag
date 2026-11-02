import { describe, expect, it } from "vitest";
import { fail } from "../support/content.js";
import { A, B, pointer, seeded, setup, T, v2 } from "../support/harness.js";

const dupes = async (docId: string) => [0, 1].map((i) => ({ id: "same", docId, index: i, text: "t", start: 0, end: 1 }));

describe("a failed add during an update", () => {
  it("a thrown replace keeps old chunks searchable and the registry at the previous version", async () => {
    const env = await seeded({});
    const bad = {
      ...env.index,
      replace: () => {
        throw new Error("disk");
      },
    };
    const svc = setup(T, { registry: env.registry, index: bad }).svc;
    expect(await fail(svc.apply({ type: "upsert", pointer: v2 }))).toBe("INDEX_FAILED");
    expect(env.registry.get("acme", "d1")).toMatchObject({ version: "v1", deletedAt: null });
    expect(env.has("acme", "d1", A)).toBe(true);
    expect(env.has("acme", "d1", B)).toBe(false);
  });

  it("a real mid-add failure rolls back inside the index", async () => {
    const env = await seeded({});
    const svc = setup(T, { registry: env.registry, index: env.index, chunk: dupes }).svc;
    expect(await fail(svc.apply({ type: "upsert", pointer: v2 }))).toBe("INDEX_FAILED");
    expect(env.registry.get("acme", "d1")).toMatchObject({ version: "v1", deletedAt: null });
    expect(env.has("acme", "d1", A)).toBe(true);
    expect(env.count("acme")).toBe(1);
  });

  it("replay after the failure succeeds", async () => {
    const env = await seeded({});
    await fail(setup(T, { registry: env.registry, index: env.index, chunk: dupes }).svc.apply({ type: "upsert", pointer: v2 }));
    const ok = setup(T, { registry: env.registry, index: env.index });
    expect((await ok.svc.apply({ type: "upsert", pointer: v2 })).outcome).toBe("updated");
    expect(env.has("acme", "d1", B)).toBe(true);
  });

  it("a brand new doc is tombstoned and leaves no chunks", async () => {
    const env = setup(T, { chunk: dupes });
    expect(await fail(env.svc.apply({ type: "upsert", pointer: pointer() }))).toBe("INDEX_FAILED");
    expect(env.registry.get("acme", "d1")?.deletedAt).not.toBeNull();
    expect(env.count("acme")).toBe(0);
  });

  it("a failed update never widens access, in the registry or the index", async () => {
    const env = await seeded({});
    const wide = { allowUsers: ["u1", "u2"], allowGroups: [], version: 2 };
    const svc = setup(T, { registry: env.registry, index: env.index, chunk: dupes }).svc;
    await fail(svc.apply({ type: "upsert", pointer: { ...v2, acl: wide } }));
    expect(env.registry.get("acme", "d1")?.acl.allowUsers).toEqual(["u1"]);
    expect(env.has("acme", "d1", A, "u1")).toBe(true);
    expect(env.has("acme", "d1", A, "u2")).toBe(false);
  });
});
