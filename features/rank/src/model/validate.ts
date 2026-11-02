import { RankError } from "./errors.js";
import type { Cols, Doc, SearchRequest } from "./types.js";

const MAX_LEN = 1024;
const MAX_PRINCIPAL = 256;
const MAX_PRINCIPALS = 256;
const MAX_TEXT = 2_000_000;
const MAX_DOC_LIST = 1000;
const MAX_BATCH = 10_000;
const MIN_KEY_BYTES = 16;

/** Lone surrogates cannot be encoded to UTF-8 faithfully. */
const wellFormed = (s: string): boolean => !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
const isWellFormed = (v: unknown): v is string => typeof v === "string" && wellFormed(v);
/** Identifiers must survive a round trip through SQLite and JSON: well-formed UTF-16, no NUL. */
const isKey = (v: unknown, max: number): v is string => isWellFormed(v) && v.length > 0 && v.length <= max && !v.includes("\0");
const isKeys = (v: unknown, max: number, cap = Number.POSITIVE_INFINITY): v is string[] => Array.isArray(v) && v.length <= cap && v.every((x) => isKey(x, max));
const isText = (v: unknown, max: number): v is string => isWellFormed(v) && v.length <= max;

export const validateDoc = (d: unknown): Doc => {
  const x = d as Partial<Doc> | null;
  const ok =
    typeof x === "object" &&
    x !== null &&
    isKey(x.id, MAX_LEN) &&
    isKey(x.path, MAX_LEN) &&
    isText(x.title, MAX_TEXT) &&
    isText(x.body, MAX_TEXT) &&
    isKeys(x.principals, MAX_PRINCIPAL, MAX_DOC_LIST) &&
    isKeys(x.links, MAX_LEN, MAX_DOC_LIST) &&
    typeof x.mtimeMs === "number" &&
    Number.isFinite(x.mtimeMs);
  if (!ok) throw new RankError("BAD_DOC", `invalid doc ${typeof x?.id === "string" ? JSON.stringify(x.id.slice(0, 40)) : ""}`.trim());
  return x as Doc;
};

/** Fail closed: anything but a non-empty list of sane principal strings is refused before the index is touched. */
export const validateRequest = (r: SearchRequest): { query: string; principals: string[]; k: number } => {
  const principals = r?.asker?.principals;
  if (!isKeys(principals, MAX_PRINCIPAL) || principals.length === 0 || principals.length > MAX_PRINCIPALS) {
    throw new RankError("BAD_ASKER", "asker.principals must be 1 to 256 non-empty strings of at most 256 characters");
  }
  if (typeof r.query !== "string") throw new RankError("BAD_QUERY", "query must be a string");
  const k = r.k ?? 10;
  if (!Number.isInteger(k) || k < 1 || k > 100) throw new RankError("BAD_QUERY", "k must be an integer from 1 to 100");
  return { query: r.query, principals, k };
};

/** A batch is checked in full, and at most 10,000 long, before anything is written. */
export const validateDocs = (docs: unknown): Doc[] => {
  if (!Array.isArray(docs)) throw new RankError("BAD_DOC", "docs must be an array");
  if (docs.length > MAX_BATCH) throw new RankError("BAD_DOC", `at most ${MAX_BATCH} docs per batch`);
  return docs.map(validateDoc);
};

/** Ids to remove follow the doc id rules. A bare string is refused, not read as a list of characters. */
export const validateIds = (ids: unknown): string[] => {
  if (!isKeys(ids, MAX_LEN, MAX_BATCH)) throw new RankError("BAD_DOC", `ids must be at most ${MAX_BATCH} non-empty strings of at most ${MAX_LEN} characters`);
  return ids;
};

const isWeight = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export const validateWeights = (w: unknown): Cols => {
  const x = w as Partial<Cols> | null;
  if (typeof x !== "object" || x === null || !isWeight(x.title) || !isWeight(x.path) || !isWeight(x.body)) {
    throw new RankError("BAD_OPTIONS", "weights must be { title, path, body }, each a finite number of at least 0");
  }
  return { title: x.title, path: x.path, body: x.body };
};

/** The key is a secret of at least 16 bytes. Anything shorter or of another type is refused, never padded. */
export const validateKey = (key: unknown): string | Uint8Array => {
  const size = typeof key === "string" ? Buffer.byteLength(key) : key instanceof Uint8Array ? key.byteLength : 0;
  if (size < MIN_KEY_BYTES) throw new RankError("BAD_OPTIONS", `key must be a string or bytes of at least ${MIN_KEY_BYTES} bytes`);
  return key as string | Uint8Array;
};
