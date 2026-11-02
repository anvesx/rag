import { afterEach, describe, expect, it } from "vitest";
import { addresses, principal } from "../../src/fixtures.js";
import type { Stack } from "../../src/stack.js";
import { type Behaviour, dirs, guarded, openLive } from "./support.js";

const alice = principal("alice", "t1");
let stack: Stack | undefined;
afterEach(() => {
  stack?.close();
  stack = undefined;
  dirs.cleanup();
});
const open = async (rules: Map<string, Behaviour>) => {
  stack?.close();
  stack = await openLive(guarded(rules));
  return stack;
};
const ask = async (rules: Array<[string, Behaviour]>) => (await open(new Map(rules))).searchLive(alice, "needle");

describe("live ACL verifier over the real stack", () => {
  it("allow: returns every hit the source lets the user read", async () => {
    expect(addresses(await ask([]))).toEqual(["a", "b", "c"]);
  });

  it("deny: drops only the hits the source hides from this user, though the cached ACL allows them", async () => {
    expect(addresses(await ask([["b", "deny"]]))).toEqual(["a", "c"]);
  });

  it("timeout: a source that never answers fails the whole search closed with a typed error", async () => {
    await expect(ask([["b", "hang"]])).rejects.toMatchObject({ name: "RetrievalError", code: "LIVE_ACL" });
  });

  it("a source error drops only that hit, and fails closed when nothing can be verified", async () => {
    expect(addresses(await ask([["b", "error"]]))).toEqual(["a", "c"]);
    const all: Array<[string, Behaviour]> = [
      ["a", "error"],
      ["b", "error"],
      ["c", "error"],
    ];
    await expect(ask(all)).rejects.toMatchObject({ code: "LIVE_ACL" });
  });

  it("a revocation at the source applies to the next search with no re-ingest, and the audit chain still verifies", async () => {
    const rules = new Map<string, Behaviour>();
    const s = await open(rules);
    expect(addresses(await s.searchLive(alice, "needle"))).toEqual(["a", "b", "c"]);
    rules.set("a", "deny");
    expect(addresses(await s.searchLive(alice, "needle"))).toEqual(["b", "c"]);
    expect(await s.verify("t1")).toMatchObject({ status: "ok" });
  });
});
