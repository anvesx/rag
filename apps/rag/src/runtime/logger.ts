import type { Logger } from "../types.js";

const line = (level: string) => (msg: string, fields?: Record<string, unknown>) => {
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields })}\n`);
};

/** One JSON object per line on stderr. Callers must not pass query text or tokens. */
export const defaultLogger: Logger = { error: line("error"), warn: line("warn"), info: line("info") };
