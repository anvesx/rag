import { describe, expect, it } from "vitest";
import { createCursorStore } from "../../src/store.js";
import { thrownBy } from "./support.js";

describe("forget", () => {
  it("lets a retry through after the handler failed", () => {
    const s = createCursorStore(":memory:", () => 0);
    expect(s.seen("t1", "evt-1")).toBe(false);
    s.forget("t1", "evt-1");
    expect(s.seen("t1", "evt-1")).toBe(false);
  });

  it("only releases the named tenant's id and tolerates an unknown id", () => {
    const s = createCursorStore(":memory:", () => 0);
    s.seen("t1", "evt-1");
    s.seen("t2", "evt-1");
    s.forget("t1", "evt-1");
    s.forget("t1", "never-seen");
    expect(s.seen("t2", "evt-1")).toBe(true);
  });

  it("rejects an empty id", () => {
    const s = createCursorStore(":memory:", () => 0);
    expect(thrownBy(() => s.forget("t1", "")).code).toBe("INVALID_INPUT");
  });
});
