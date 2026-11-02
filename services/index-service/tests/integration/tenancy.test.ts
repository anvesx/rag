import { describe, expect, it } from "vitest";
import { pointer, setup, sha } from "../support/harness.js";

const T = { "acme/d1@v1": "alpha shared", "globex/d1@v1": "omega shared" };
const globex = () => pointer({ tenantId: "globex", contentHash: sha("omega shared") });
const acme = () => pointer({ contentHash: sha("alpha shared") });

describe("tenant isolation", () => {
  it("same docId in two tenants stays separate through delete", async () => {
    const { svc, has, count, registry } = setup(T);
    await svc.apply({ type: "upsert", pointer: acme() });
    await svc.apply({ type: "upsert", pointer: globex() });
    expect(has("acme", "d1", "alpha shared")).toBe(true);
    expect(has("acme", "d1", "omega shared")).toBe(false);
    expect(has("globex", "d1", "omega shared")).toBe(true);
    expect(has("globex", "d1", "alpha shared")).toBe(false);

    await svc.apply({ type: "delete", tenantId: "acme", id: "d1", at: "2026-02-01T00:00:00.000Z" });
    expect(count("acme")).toBe(0);
    expect(has("globex", "d1", "omega shared")).toBe(true);
    expect(registry.get("globex", "d1")).toBeDefined();
  });

  it("updating one tenant leaves the other's chunks alone", async () => {
    const env = setup({ ...T, "acme/d1@v2": "new text" });
    await env.svc.apply({ type: "upsert", pointer: acme() });
    await env.svc.apply({ type: "upsert", pointer: globex() });
    await env.svc.apply({ type: "upsert", pointer: pointer({ version: "v2", contentHash: sha("new text") }) });
    expect(env.has("acme", "d1", "new text")).toBe(true);
    expect(env.has("globex", "d1", "omega shared")).toBe(true);
  });

  it("failure in one tenant does not disturb the other", async () => {
    const env = setup(T);
    await env.svc.apply({ type: "upsert", pointer: globex() });
    const boom = async () => Promise.reject(new Error("x"));
    const bad = setup(T, { registry: env.registry, index: env.index, embed: boom });
    await expect(bad.svc.apply({ type: "upsert", pointer: acme() })).rejects.toBeDefined();
    expect(env.has("globex", "d1", "omega shared")).toBe(true);
    expect(env.count("acme")).toBe(0);
  });
});
