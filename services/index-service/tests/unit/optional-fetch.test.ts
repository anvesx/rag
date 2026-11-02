import { describe, expect, it } from "vitest";
import { A, pointer, setup, sha, T } from "../support/harness.js";

const noFetch = () => setup(T, { fetchText: undefined });
const body = { text: A, contentHash: sha(A) };
const doc = () => pointer({ contentHash: sha(A) });

describe("fetchText is optional", () => {
  it("indexes an upsert that carries content", async () => {
    const env = noFetch();
    const out = await env.svc.apply({ type: "upsert", pointer: doc(), content: body });
    expect(out).toMatchObject({ outcome: "created" });
    expect(out.chunks).toBeGreaterThan(0);
    expect(env.count("acme")).toBeGreaterThan(0);
  });

  it("rejects an upsert without content as INVALID_EVENT and changes nothing", async () => {
    const env = noFetch();
    await expect(env.svc.apply({ type: "upsert", pointer: doc() })).rejects.toMatchObject({ name: "IndexServiceError", code: "INVALID_EVENT" });
    expect(env.count("acme")).toBe(0);
    expect(env.registry.get("acme", "d1")?.deletedAt).not.toBeNull();
  });

  it("recovers on replay once the content is supplied", async () => {
    const env = noFetch();
    await expect(env.svc.apply({ type: "upsert", pointer: doc() })).rejects.toThrow();
    const out = await env.svc.apply({ type: "upsert", pointer: doc(), content: body });
    expect(out.outcome).not.toBe("unchanged");
    expect(env.count("acme")).toBeGreaterThan(0);
  });

  it("still treats an unchanged pointer without content as unchanged", async () => {
    const env = noFetch();
    await env.svc.apply({ type: "upsert", pointer: doc(), content: body });
    await expect(env.svc.apply({ type: "upsert", pointer: doc() })).resolves.toEqual({ outcome: "unchanged", chunks: 0 });
  });

  it("deletes without fetchText", async () => {
    const env = noFetch();
    await env.svc.apply({ type: "upsert", pointer: doc(), content: body });
    const out = await env.svc.apply({ type: "delete", tenantId: "acme", id: "d1", at: "2026-02-01T00:00:00.000Z" });
    expect(out.outcome).toBe("deleted");
    expect(env.count("acme")).toBe(0);
  });
});
