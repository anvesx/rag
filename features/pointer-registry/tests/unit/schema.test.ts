import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { ptr } from "../fixtures.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("table shape", () => {
  it("has exactly the pointer columns, none able to hold body text", () => {
    const dir = mkdtempSync(join(tmpdir(), "pr-"));
    dirs.push(dir);
    const file = join(dir, "r.db");
    const r = createRegistry(file);
    r.close();
    const db = new DatabaseSync(file);
    const cols = db
      .prepare("PRAGMA table_info(pointers)")
      .all()
      .map((c) => c["name"]);
    const pk = db
      .prepare("PRAGMA table_info(pointers)")
      .all()
      .filter((c) => c["pk"] !== 0)
      .map((c) => c["name"]);
    db.close();
    expect(cols).toEqual([
      "tenant_id",
      "id",
      "source",
      "address",
      "title",
      "version",
      "content_hash",
      "zone",
      "acl_json",
      "acl_version",
      "updated_at",
      "deleted_at",
    ]);
    expect(pk).toEqual(["tenant_id", "id"]);
  });
});

describe("unicode and size", () => {
  it("round-trips unicode ids, titles and 2048-char addresses", () => {
    const r = createRegistry(":memory:");
    const p = ptr({ id: "文書-🙂-é", title: "Ünï 🙂", address: `https://x.test/${"é".repeat(2000)}`.slice(0, 2048) });
    expect(r.upsert(p).change).toBe("created");
    expect(r.get("t1", "文書-🙂-é")).toEqual(p);
    const long = ptr({ id: "long", address: "a".repeat(2048) });
    r.upsert(long);
    expect(r.get("t1", "long")?.address).toHaveLength(2048);
  });
  it("round-trips acl lists", () => {
    const r = createRegistry(":memory:");
    const p = ptr({ acl: { allowUsers: ["u1", "ü2"], allowGroups: ["g1"], version: 7 } });
    r.upsert(p);
    expect(r.get("t1", "doc-1")?.acl).toEqual(p.acl);
  });
  it("opens twice on :memory: independently", () => {
    const a = createRegistry(":memory:");
    const b = createRegistry(":memory:");
    a.upsert(ptr());
    expect(b.get("t1", "doc-1")).toBeUndefined();
  });
});
