import { describe, expect, it } from "vitest";
import { createCursorStore } from "../../src/store.js";
import { thrownBy } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("seen", () => {
  it("is false the first time an id arrives and true after", () => {
    const s = createCursorStore(":memory:", () => 0);
    expect(s.seen("t1", "evt-1")).toBe(false);
    expect(s.seen("t1", "evt-1")).toBe(true);
    expect(s.seen("t1", "evt-2")).toBe(false);
  });

  it("forgets an id once the ttl has passed, using the injected clock", () => {
    let now = 1_000;
    const s = createCursorStore(":memory:", () => now, 100);
    expect(s.seen("t1", "evt")).toBe(false);
    now = 1_099;
    expect(s.seen("t1", "evt")).toBe(true);
    now = 1_100;
    expect(s.seen("t1", "evt")).toBe(false);
    now = 1_150;
    expect(s.seen("t1", "evt")).toBe(true);
  });

  it("defaults the ttl to 24 hours", () => {
    let now = 0;
    const s = createCursorStore(":memory:", () => now);
    expect(s.seen("t1", "evt")).toBe(false);
    now = DAY_MS - 1;
    expect(s.seen("t1", "evt")).toBe(true);
    now = DAY_MS;
    expect(s.seen("t1", "evt")).toBe(false);
  });

  it("is case-sensitive and unicode-safe", () => {
    const s = createCursorStore(":memory:", () => 0);
    expect(s.seen("t1", "Ä")).toBe(false);
    expect(s.seen("t1", "ä")).toBe(false);
    expect(s.seen("t1", "Ä")).toBe(true);
  });

  it.each([[""], [null], [5], [{}]])("rejects a bad event id %j", (bad) => {
    const s = createCursorStore(":memory:", () => 0);
    const err = thrownBy(() => s.seen("t1", bad as never));
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toContain("eventId");
  });

  it.each([[0], [-1], [Number.NaN], [1.5], [Number.POSITIVE_INFINITY], ["100"]])("rejects a bad ttl %j", (ttl) => {
    expect(thrownBy(() => createCursorStore(":memory:", () => 0, ttl as never)).message).toContain("ttlMs");
  });

  it("rejects a clock that is not a function", () => {
    expect(thrownBy(() => createCursorStore(":memory:", 5 as never)).message).toContain("clock must be a function");
  });

  it("rejects an empty database path", () => {
    expect(thrownBy(() => createCursorStore("", () => 0)).message).toContain("dbPath");
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], ["now"]])("rejects a clock that returns %j", (bad) => {
    const s = createCursorStore(":memory:", () => bad as never);
    const err = thrownBy(() => s.seen("t1", "evt"));
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toContain("clock must return");
  });
});
