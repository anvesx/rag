import { CursorError } from "./errors.js";

/** What changed between the known listing and the listing the source reports now. */
export interface ListingDiff {
  created: string[];
  updated: string[];
  deleted: string[];
}

/** Maps are address -> version. Keys must be non-empty strings, versions strings. */
function requireListing(name: string, value: unknown): Map<string, string> {
  if (!(value instanceof Map)) {
    throw new CursorError("INVALID_INPUT", `${name} must be a Map of address to version`);
  }
  for (const [address, version] of value) {
    if (typeof address !== "string" || address.length === 0) {
      throw new CursorError("INVALID_INPUT", `${name} has an empty or non-string address`);
    }
    if (typeof version !== "string") {
      throw new CursorError("INVALID_INPUT", `${name} has a non-string version`);
    }
  }
  return value;
}

/**
 * Pure reconciliation diff. Each list is sorted by UTF-16 code unit order.
 * An address in `known` but not `listed` is reported once, as deleted.
 */
export function diffListing(known: Map<string, string>, listed: Map<string, string>): ListingDiff {
  const before = requireListing("known", known);
  const now = requireListing("listed", listed);
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  for (const [address, version] of now) {
    const previous = before.get(address);
    if (previous === undefined) created.push(address);
    else if (previous !== version) updated.push(address);
  }
  for (const address of before.keys()) {
    if (!now.has(address)) deleted.push(address);
  }
  return { created: created.sort(), updated: updated.sort(), deleted: deleted.sort() };
}
