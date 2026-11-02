import { DatabaseSync } from "node:sqlite";
import { type Pointer, PointerSchema } from "@brain/core-types";
import { isUnchanged } from "./change.js";
import { RegistryError } from "./errors.js";
import { DDL, fromRow, SQL, toParams } from "./schema.js";

export interface Registry {
  upsert(p: Pointer): { pointer: Pointer; change: "created" | "updated" | "unchanged" };
  get(tenantId: string, id: string): Pointer | undefined;
  list(q: { tenantId: string; afterId?: string; limit?: number }): Pointer[];
  tombstone(tenantId: string, id: string, at: string): boolean;
  close(): void;
}

const [DEFAULT_LIMIT, MAX_LIMIT] = [100, 1000];

const needTenant = (t: unknown): string => {
  if (typeof t !== "string" || t === "") throw new RegistryError("TENANT_REQUIRED", "tenantId is required");
  return t;
};

export function createRegistry(dbPath: string): Registry {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; ${DDL}`);
  const sel = db.prepare(SQL.one);
  const ins = db.prepare(SQL.insert);
  const upd = db.prepare(SQL.update);
  const page = db.prepare(SQL.page);
  const tomb = db.prepare(SQL.tombstone);

  type Change = "created" | "updated" | "unchanged";
  const write = (p: Pointer): Change => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = sel.get(p.tenantId, p.id);
      let change: Change = "created";
      if (row === undefined) ins.run(...toParams(p));
      else if (isUnchanged(fromRow(row), p)) change = "unchanged";
      else {
        change = "updated";
        upd.run(...toParams(p).slice(2), p.tenantId, p.id);
      }
      db.exec("COMMIT");
      return change;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  return {
    upsert(input) {
      if (typeof input === "object" && input !== null && !Array.isArray(input)) needTenant((input as { tenantId?: unknown }).tenantId);
      const parsed = PointerSchema.safeParse(input);
      if (!parsed.success) throw new RegistryError("INVALID", parsed.error.message);
      const change = write(parsed.data);
      const stored = change === "unchanged" ? sel.get(parsed.data.tenantId, parsed.data.id) : undefined;
      return { pointer: stored ? fromRow(stored) : parsed.data, change };
    },
    get(tenantId, id) {
      const row = sel.get(needTenant(tenantId), id);
      const p = row && fromRow(row);
      return p && p.deletedAt === null ? p : undefined;
    },
    list(q) {
      const tenantId = needTenant(q?.tenantId);
      const limit = q.limit ?? DEFAULT_LIMIT;
      if (!Number.isInteger(limit) || limit < 1) throw new RegistryError("INVALID", "limit must be a positive integer");
      return page.all(tenantId, q.afterId ?? "", Math.min(limit, MAX_LIMIT)).map(fromRow);
    },
    tombstone(tenantId, id, at) {
      needTenant(tenantId);
      const ok = PointerSchema.shape.updatedAt.safeParse(at);
      if (!ok.success) throw new RegistryError("INVALID", "at must be an ISO datetime");
      return Number(tomb.run(at, tenantId, id).changes) > 0;
    },
    close: () => db.close(),
  };
}
