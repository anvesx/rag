import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCursorStore } from "../../src/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "change-cursor-tenant-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const rows = (path: string): number => {
  const db = new DatabaseSync(path);
  const row = db.prepare("SELECT count(*) AS n FROM seen_events").get() as { n: number };
  db.close();
  return row.n;
};

describe("seen is scoped by tenant", () => {
  it("does not let one tenant's event id suppress another tenant's", () => {
    const s = createCursorStore(join(dir, "cursor.db"), () => 0);
    expect(s.seen("tenant-a", "evt-1")).toBe(false);
    expect(s.seen("tenant-b", "evt-1")).toBe(false);
    expect(s.seen("tenant-a", "evt-1")).toBe(true);
    expect(s.seen("tenant-b", "evt-1")).toBe(true);
  });

  it("does not collide on separator characters in tenant or event id", () => {
    const s = createCursorStore(join(dir, "cursor.db"), () => 0);
    expect(s.seen("a:b", "c")).toBe(false);
    expect(s.seen("a", "b:c")).toBe(false);
  });

  it("rejects an empty or non-string tenant", () => {
    const s = createCursorStore(join(dir, "cursor.db"), () => 0);
    for (const bad of ["", null, 5]) expect(() => s.seen(bad as never, "evt")).toThrow(/tenantId/);
  });
});

describe("seen prunes expired rows", () => {
  it("deletes expired rows of every tenant on the next call", () => {
    const path = join(dir, "prune.db");
    let now = 0;
    const s = createCursorStore(path, () => now, 100);
    for (let i = 0; i < 50; i++) s.seen(i % 2 ? "a" : "b", `evt-${i}`);
    expect(rows(path)).toBe(50);
    now = 100;
    s.seen("a", "fresh");
    expect(rows(path)).toBe(1);
  });

  it("keeps rows that are still inside the ttl", () => {
    const path = join(dir, "keep.db");
    let now = 0;
    const s = createCursorStore(path, () => now, 100);
    s.seen("a", "old");
    now = 99;
    s.seen("a", "new");
    expect(rows(path)).toBe(2);
    expect(s.seen("a", "old")).toBe(true);
  });

  it("replaces a legacy tenant-less seen_events table", () => {
    const path = join(dir, "legacy.db");
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE seen_events (event_id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL); INSERT INTO seen_events VALUES ('evt-1', 0);");
    db.close();
    const s = createCursorStore(path, () => 0);
    expect(s.seen("t", "evt-1")).toBe(false);
    expect(s.seen("t", "evt-1")).toBe(true);
  });
});
