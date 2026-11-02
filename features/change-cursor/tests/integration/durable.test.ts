import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCursorStore } from "../../src/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "change-cursor-durable-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("durable state in a file database", () => {
  it("keeps cursors and seen ids after the file is reopened", () => {
    const path = join(dir, "cursor.db");
    const first = createCursorStore(path, () => 0, 1_000);
    first.setCursor("t1", "drive", "cur-9");
    first.seen("t1", "evt-1");

    const second = createCursorStore(path, () => 0, 1_000);
    expect(second.getCursor("t1", "drive")).toBe("cur-9");
    expect(second.seen("t1", "evt-1")).toBe(true);
  });

  it("applies the ttl to ids recorded before a reopen", () => {
    const path = join(dir, "cursor.db");
    createCursorStore(path, () => 0, 1_000).seen("t1", "evt-1");
    const later = createCursorStore(path, () => 1_000, 1_000);
    expect(later.seen("t1", "evt-1")).toBe(false);
  });

  it("creates the file on first open and reuses it", () => {
    const path = join(dir, "nested-name.db");
    createCursorStore(path, () => 0).setCursor("t1", "drive", "x");
    expect(createCursorStore(path, () => 0).getCursor("t1", "drive")).toBe("x");
  });

  it("opens the file in WAL mode", () => {
    const path = join(dir, "wal.db");
    createCursorStore(path, () => 0);
    const probe = new DatabaseSync(path);
    expect(probe.prepare("PRAGMA journal_mode").get()?.journal_mode).toBe("wal");
    probe.close();
  });
});
