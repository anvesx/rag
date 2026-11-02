import type { IncomingMessage } from "node:http";
import { McpServiceError } from "../errors.js";

export const MAX_BODY_BYTES = 1_048_576;

/** Reads and parses a JSON request body, refusing anything over `max` bytes. */
export async function readJson(req: IncomingMessage, max: number = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > max) throw new McpServiceError("BODY_TOO_LARGE", "Request body too large");
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new McpServiceError("BAD_JSON", "Request body is not valid JSON");
  }
}
