import { createHash } from "node:crypto";
import type { Pointer } from "@brain/core-types";
import { type Content, IndexServiceError } from "../types.js";

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Fetched text must hash to the pointer's contentHash: the source may have changed between list and fetch. */
export function verifyFetched(pointer: Pointer, text: string): void {
  if (sha256(text) !== pointer.contentHash) throw new IndexServiceError("HASH_MISMATCH");
}

/**
 * Check caller-supplied text against the pointer and return it. The claimed hash must equal the pointer's, and
 * the text must really hash to it, so a stale or wrong body can never be indexed under the pointer.
 */
export function verifyContent(pointer: Pointer, content: Content): string {
  if (typeof content?.text !== "string" || typeof content.contentHash !== "string") throw new IndexServiceError("INVALID_EVENT");
  if (content.contentHash !== pointer.contentHash || sha256(content.text) !== pointer.contentHash) throw new IndexServiceError("HASH_MISMATCH");
  return content.text;
}
