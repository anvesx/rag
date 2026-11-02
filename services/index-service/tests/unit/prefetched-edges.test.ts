import { chunkText } from "@rag/chunker";
import { describe, expect, it } from "vitest";
import { fail, withText } from "../support/content.js";
import { A, setup, sha } from "../support/harness.js";

describe("pre-fetched content edge cases", () => {
  it("empty text indexes zero chunks without fetching", async () => {
    const { svc, calls } = setup({});
    expect(await svc.apply(withText(""))).toEqual({ outcome: "created", chunks: 0 });
    expect(calls.fetch).toBe(0);
  });

  it("unicode text is hashed as utf-8 and searchable", async () => {
    const u = "héllo 日本語 🙂";
    const { svc, has } = setup({});
    await svc.apply(withText(u));
    expect(has("acme", "d1", u)).toBe(true);
  });

  it("huge text indexes every chunk", async () => {
    const big = "lorem ipsum ".repeat(200_000);
    const { svc, calls, count } = setup({}, { chunk: (id, t) => chunkText(id, t, { size: 20_000, overlap: 0 }) });
    const r = await svc.apply(withText(big));
    expect(r.chunks).toBeGreaterThan(100);
    expect(count("acme")).toBeGreaterThan(0); // search caps at 50 hits
    expect(calls.fetch).toBe(0);
  });

  it("an unchanged pointer ignores content and does nothing", async () => {
    const { svc, calls } = setup({});
    await svc.apply(withText(A));
    expect(await svc.apply(withText(A))).toEqual({ outcome: "unchanged", chunks: 0 });
    expect(calls.embed).toBe(1);
  });

  it("malformed content is an invalid event and changes nothing", async () => {
    const { svc, registry } = setup({});
    const bad = { ...withText(A), content: { text: 5, contentHash: sha(A) } } as never;
    expect(await fail(svc.apply(bad))).toBe("INVALID_EVENT");
    expect(registry.get("acme", "d1")).toBeUndefined();
  });

  it("a failed embed restores state and a retry with the same content succeeds", async () => {
    let down = true;
    const embed = async (ts: string[]) => (down ? Promise.reject(new Error("down")) : ts.map(() => [1, 1, 1]));
    const { svc, registry, calls, count } = setup({}, { embed });
    expect(await fail(svc.apply(withText(A)))).toBe("EMBED_FAILED");
    expect(registry.get("acme", "d1")).toBeUndefined();
    down = false;
    expect(await svc.apply(withText(A))).toEqual({ outcome: "updated", chunks: 1 }); // the failed create was tombstoned
    expect(count("acme")).toBe(1);
    expect(calls.fetch).toBe(0);
  });
});
