import { describe, expect, it } from "vitest";
import { fail, withText } from "../support/content.js";
import { A, B, pointer, setup, sha } from "../support/harness.js";

describe("apply with pre-fetched content", () => {
  it("indexes the supplied text and never calls fetchText", async () => {
    const { svc, calls, has } = setup({});
    expect(await svc.apply(withText(A))).toEqual({ outcome: "created", chunks: 1 });
    expect(calls.fetch).toBe(0);
    expect(has("acme", "d1", A)).toBe(true);
  });

  it("still fetches when no content is supplied", async () => {
    const { svc, calls, has } = setup({ "acme/d1@v1": A });
    await svc.apply({ type: "upsert", pointer: pointer() });
    expect(calls.fetch).toBe(1);
    expect(has("acme", "d1", A)).toBe(true);
  });

  it("an update with content replaces the old chunks", async () => {
    const { svc, calls, has, count } = setup({});
    await svc.apply(withText(A));
    expect(await svc.apply(withText(B, { version: "v2" }))).toEqual({ outcome: "updated", chunks: 1 });
    expect(has("acme", "d1", B)).toBe(true);
    expect(count("acme")).toBe(1);
    expect(calls.fetch).toBe(0);
  });

  it("a hash mismatch is rejected before any state changes", async () => {
    const { svc, calls, registry, count } = setup({});
    const bad = { ...withText(A), content: { text: A, contentHash: sha(B) } };
    expect(await fail(svc.apply(bad))).toBe("HASH_MISMATCH");
    expect(registry.get("acme", "d1")).toBeUndefined();
    expect(count("acme")).toBe(0);
    expect(calls.fetch).toBe(0);
  });

  it("a mismatch on an existing doc leaves its pointer and chunks alone", async () => {
    const { svc, registry, has } = setup({});
    await svc.apply(withText(A));
    const bad = { ...withText(B, { version: "v2" }), content: { text: A, contentHash: sha(B) } };
    expect(await fail(svc.apply(bad))).toBe("HASH_MISMATCH");
    expect(registry.get("acme", "d1")?.version).toBe("v1");
    expect(has("acme", "d1", A)).toBe(true);
  });
});
