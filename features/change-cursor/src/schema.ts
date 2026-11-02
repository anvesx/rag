import { CursorError } from "./errors.js";

/** Longest cursor value, counted in code points. */
export const CURSOR_MAX_CHARS = 4096;
/** How long a seen event id is remembered when the caller sets no ttl. */
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Database shape. One row per (tenant, source) cursor and one row per (tenant, event id) seen. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cursors (
  tenant_id TEXT NOT NULL,
  source    TEXT NOT NULL,
  cursor    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, source)
);
CREATE TABLE IF NOT EXISTS seen_events (
  tenant_id TEXT NOT NULL,
  event_id  TEXT NOT NULL,
  seen_at   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);
CREATE INDEX IF NOT EXISTS seen_events_seen_at ON seen_events (seen_at);`;

/** Drops the pre-tenant seen_events table (event_id only). Its rows are 24 h dedupe state, so losing them is safe. */
export const DROP_LEGACY_SEEN_SQL = "DROP TABLE IF EXISTS seen_events";

const invalid = (message: string): CursorError => new CursorError("INVALID_INPUT", message);

/** Requires a non-empty string. */
export function requireText(name: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalid(`${name} must be a non-empty string`);
  }
  return value;
}

/** Requires a string of at most CURSOR_MAX_CHARS code points. The empty string is allowed. */
export function requireCursor(value: unknown): string {
  if (typeof value !== "string") throw invalid("cursor must be a string");
  if ([...value].length > CURSOR_MAX_CHARS) {
    throw new CursorError("CURSOR_TOO_LARGE", `cursor exceeds ${CURSOR_MAX_CHARS} characters`);
  }
  return value;
}

/** Requires a positive safe integer. */
export function requirePositiveInt(name: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw invalid(`${name} must be a positive integer`);
  }
  return value as number;
}

/** Requires a function. */
export function requireFunction(name: string, value: unknown): () => number {
  if (typeof value !== "function") throw invalid(`${name} must be a function`);
  return value as () => number;
}

/** Requires the clock to return a finite number of milliseconds. */
export function requireTime(value: unknown): number {
  if (!Number.isFinite(value)) {
    throw invalid("clock must return a finite number of milliseconds");
  }
  return value as number;
}
