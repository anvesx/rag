import { DatabaseSync, type StatementSync } from "node:sqlite";
import { DEFAULT_TTL_MS, DROP_LEGACY_SEEN_SQL, requireCursor, requireFunction, requirePositiveInt, requireText, requireTime, SCHEMA_SQL } from "./schema.js";

/** Durable cursor and dedupe state, backed by one SQLite file. */
export interface CursorStore {
  getCursor(tenantId: string, source: string): string | undefined;
  setCursor(tenantId: string, source: string, cursor: string): void;
  /** Atomically records the id for this tenant. Returns true if the tenant already saw it inside the ttl. */
  seen(tenantId: string, eventId: string): boolean;
  /** Releases the id so a retry is not suppressed. Call it when the handler for a seen event failed. */
  forget(tenantId: string, eventId: string): void;
}

/** Opens (or creates) the store; `close()` releases the SQLite handle. `clock` returns milliseconds. `ttlMs` defaults to 24 hours. */
export function createCursorStore(dbPath: string, clock: () => number, ttlMs: number = DEFAULT_TTL_MS): CursorStore & { close(): void } {
  const path = requireText("dbPath", dbPath);
  const now = requireFunction("clock", clock);
  const ttl = requirePositiveInt("ttlMs", ttlMs);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  if (!db.prepare("SELECT 1 FROM pragma_table_info('seen_events') WHERE name = 'tenant_id'").get()) db.exec(DROP_LEGACY_SEEN_SQL);
  db.exec(SCHEMA_SQL);
  const stmts = prepare(db);
  return {
    getCursor(tenantId, source) {
      const row = stmts.get.get(requireText("tenantId", tenantId), requireText("source", source));
      return row === undefined ? undefined : (row.cursor as string);
    },
    setCursor(tenantId, source, cursor) {
      stmts.set.run(requireText("tenantId", tenantId), requireText("source", source), requireCursor(cursor));
    },
    seen(tenantId, eventId) {
      const tenant = requireText("tenantId", tenantId);
      const id = requireText("eventId", eventId);
      const at = requireTime(now());
      // Prune every tenant's expired rows, then one statement: insert, or refresh only if this tenant's
      // old record expired. No change means seen.
      stmts.prune.run(at - ttl);
      return stmts.seen.run(tenant, id, at, at - ttl).changes === 0;
    },
    forget(tenantId, eventId) {
      stmts.forget.run(requireText("tenantId", tenantId), requireText("eventId", eventId));
    },
    close: () => db.close(),
  };
}

function prepare(db: DatabaseSync): Record<"get" | "set" | "seen" | "prune" | "forget", StatementSync> {
  return {
    get: db.prepare("SELECT cursor FROM cursors WHERE tenant_id = ? AND source = ?"),
    set: db.prepare(
      "INSERT INTO cursors (tenant_id, source, cursor) VALUES (?, ?, ?) " + "ON CONFLICT(tenant_id, source) DO UPDATE SET cursor = excluded.cursor",
    ),
    seen: db.prepare(
      "INSERT INTO seen_events (tenant_id, event_id, seen_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(tenant_id, event_id) DO UPDATE SET seen_at = excluded.seen_at WHERE seen_events.seen_at <= ?",
    ),
    prune: db.prepare("DELETE FROM seen_events WHERE seen_at <= ?"),
    forget: db.prepare("DELETE FROM seen_events WHERE tenant_id = ? AND event_id = ?"),
  };
}
