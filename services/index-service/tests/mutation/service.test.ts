import { describe, expect, it } from "vitest";
import { pointer, seeded, setup, T } from "../support/harness.js";

const del = { type: "delete", tenantId: "acme", id: "d1", at: "2026-01-02T00:00:00.000Z" } as const;
const throwing = (error: unknown) => () => {
  throw error;
};

describe("delete path error mapping", () => {
  it("maps a RegistryError from tombstone to INVALID_EVENT, keeping the cause", async () => {
    const env = await seeded({});
    const cause = Object.assign(new Error("bad at"), { name: "RegistryError" });
    const registry = { ...env.registry, tombstone: throwing(cause) };
    const svc = setup(T, { registry, index: env.index }).svc;
    await expect(svc.apply(del)).rejects.toMatchObject({ name: "IndexServiceError", code: "INVALID_EVENT", cause });
  });

  it("maps any other Error from tombstone to INDEX_FAILED", async () => {
    const env = await seeded({});
    const cause = new Error("db gone");
    const svc = setup(T, { registry: { ...env.registry, tombstone: throwing(cause) }, index: env.index }).svc;
    await expect(svc.apply(del)).rejects.toMatchObject({ code: "INDEX_FAILED", cause });
  });

  it("maps an index.remove failure to INDEX_FAILED and leaves the pointer live", async () => {
    const env = await seeded({});
    const cause = new Error("disk");
    const svc = setup(T, { registry: env.registry, index: { ...env.index, remove: throwing(cause) } }).svc;
    await expect(svc.apply(del)).rejects.toMatchObject({ code: "INDEX_FAILED", cause });
    expect(env.registry.get("acme", "d1")?.deletedAt).toBeNull();
  });

  it("maps a thrown non-Error to INDEX_FAILED", async () => {
    const env = await seeded({});
    const svc = setup(T, { registry: { ...env.registry, tombstone: throwing("oops") }, index: env.index }).svc;
    await expect(svc.apply(del)).rejects.toMatchObject({ code: "INDEX_FAILED", cause: "oops" });
  });
});

describe("upsert registry failure", () => {
  it("maps a registry rejection to INVALID_EVENT, keeping the cause", async () => {
    const env = setup(T);
    const cause = new Error("rejected");
    const registry = { ...env.registry, upsert: throwing(cause) };
    const svc = setup(T, { registry, index: env.index }).svc;
    await expect(svc.apply({ type: "upsert", pointer: pointer() })).rejects.toMatchObject({ code: "INVALID_EVENT", cause });
  });
});
