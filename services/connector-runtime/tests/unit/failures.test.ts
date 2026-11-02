import type { CursorStore } from "@rag/change-cursor";
import { describe, expect, it } from "vitest";
import { failureStore } from "../../src/state/failures.js";

const memory = () => {
  const m = new Map<string, string>();
  const writes: string[] = [];
  const cursors: CursorStore = {
    getCursor: (t, k) => m.get(`${t}|${k}`),
    setCursor: (t, k, v) => {
      writes.push(k);
      m.set(`${t}|${k}`, v);
    },
    seen: () => false,
    forget() {},
  };
  return { m, writes, store: failureStore(cursors, "b") };
};
const fail = (address: string, error = "e") => ({ address, error });
describe("failureStore attempts", () => {
  it("counts per event id, sharing a count between ids with the same 16-char prefix", () => {
    const { store } = memory();
    expect(store.bump("t", "x")).toBe(1);
    expect(store.bump("t", "x")).toBe(2);
    expect(store.bump("t", "y")).toBe(1);
    expect(store.bump("t", "0123456789abcdef-1")).toBe(1);
    expect(store.bump("t", "0123456789abcdef-2")).toBe(2);
  });

  it("clear forgets only that id, and empties the stored value when none remain", () => {
    const { store, m } = memory();
    store.bump("t", "x");
    store.bump("t", "y");
    store.clear("t", "x", "ax");
    expect(JSON.parse(m.get("t|b#attempts") as string)).toEqual({ y: 1 });
    store.clear("t", "y", "ay");
    expect(m.get("t|b#attempts")).toBe("");
  });

  it("clear writes nothing when there is nothing to forget", () => {
    const { store, writes } = memory();
    store.clear("t", "x", "ax");
    expect(writes).toEqual([]);
  });
});

describe("failureStore quarantine", () => {
  it("isDead matches by 16-char id prefix", () => {
    const { store } = memory();
    expect(store.isDead("t", "0123456789abcdefZ")).toBe(false);
    store.bury("t", "0123456789abcdefA", fail("a"));
    expect(store.isDead("t", "0123456789abcdefB")).toBe(true);
    expect(store.isDead("t", "other")).toBe(false);
  });

  it("clear drops entries for the same address only, writing an empty value when none remain", () => {
    const { store, m, writes } = memory();
    store.bury("t", "1", fail("a"));
    store.bury("t", "2", fail("b"));
    store.clear("t", "z", "a");
    expect(store.quarantined("t")).toEqual([fail("b")]);
    writes.length = 0;
    store.clear("t", "z", "nope");
    expect(writes).toEqual([]);
    store.clear("t", "z", "b");
    expect(m.get("t|b#dead")).toBe("");
    expect(store.quarantined("t")).toEqual([]);
  });

  it("truncates errors to 60 chars and keeps the newest 20 entries in order", () => {
    const { store } = memory();
    store.bury("t", "long", fail("l", "x".repeat(100)));
    expect(store.quarantined("t")[0]?.error).toBe("x".repeat(60));
    for (let i = 0; i < 25; i++) store.bury("t", `id${i}`, fail(`a${i}`));
    const q = store.quarantined("t");
    expect(q).toHaveLength(20);
    expect(q[0]?.address).toBe("a5");
    expect(q[19]?.address).toBe("a24");
  });
});
