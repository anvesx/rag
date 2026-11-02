import { createHash } from "node:crypto";
import { canonicalize } from "json-canonicalize";
import { AuditError } from "./errors.js";

export type AuditEvent = {
  tenantId: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  detail?: Record<string, unknown>;
};

export const GENESIS = "0".repeat(64);
export const MAX_FIELD = 1024;
export const MAX_DETAIL = 65536;
const KEYS = new Set(["tenantId", "actor", "action", "target", "at", "detail"]);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// NUL truncates SQLite text; a lone surrogate would be rewritten to U+FFFD. Either breaks the hash.
// biome-ignore lint/suspicious/noControlCharactersInRegex: NUL is deliberately rejected
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const bad = (msg: string): never => {
  throw new AuditError("INVALID", msg);
};

/** Checks every field; returns the canonical detail JSON (or null when absent). */
export function validateEvent(e: unknown): string | null {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return bad("event must be an object");
  const o = e as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) bad(`unknown field ${k}`);
  for (const k of ["tenantId", "actor", "action", "target", "at"]) {
    const v = o[k];
    if (typeof v !== "string" || v.length === 0) bad(`${k} must be a non-empty string`);
    if ((v as string).length > MAX_FIELD) bad(`${k} longer than ${MAX_FIELD}`);
    if (UNSTORABLE.test(v as string)) bad(`${k} contains NUL or a lone surrogate`);
  }
  if (!ISO.test(o.at as string) || Number.isNaN(Date.parse(o.at as string))) bad("at must be ISO-8601");
  if (o.detail === undefined) return null;
  const d = o.detail;
  if (typeof d !== "object" || d === null || Array.isArray(d)) return bad("detail must be a plain object");
  let json: string;
  try {
    json = canonicalize(d);
  } catch (err) {
    throw new AuditError("INVALID", "detail is not canonical JSON", { cause: err });
  }
  if (json.length > MAX_DETAIL) bad(`detail larger than ${MAX_DETAIL}`);
  return json;
}

/** sha256(prevHash + canonical(event)), hex. */
export function hashEvent(prev: string, e: AuditEvent): string {
  return createHash("sha256")
    .update(prev + canonicalize(e))
    .digest("hex");
}
