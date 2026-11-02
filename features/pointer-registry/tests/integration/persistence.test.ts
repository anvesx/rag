import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { ptr } from "../fixtures.js";

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "pr-"));
  dirs.push(d);
  return join(d, "r.db");
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("file-backed db", () => {
  it("survives reopen, including tombstones and change detection", () => {
    const file = tmp();
    const a = createRegistry(file);
    a.upsert(ptr({ id: "keep" }));
    a.upsert(ptr({ id: "gone" }));
    a.tombstone("t1", "gone", "2026-11-02T00:00:00Z");
    a.close();
    const b = createRegistry(file);
    expect(b.get("t1", "keep")).toEqual(ptr({ id: "keep" }));
    expect(b.get("t1", "gone")).toBeUndefined();
    expect(b.upsert(ptr({ id: "keep" })).change).toBe("unchanged");
    b.close();
  });
  it("two open handles on one file see each other's writes", () => {
    const file = tmp();
    const a = createRegistry(file);
    const b = createRegistry(file);
    a.upsert(ptr());
    expect(b.upsert(ptr()).change).toBe("unchanged");
    a.close();
    b.close();
  });
});
