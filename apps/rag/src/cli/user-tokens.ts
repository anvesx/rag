import { readFileSync, statSync } from "node:fs";
import type { Connector } from "@brain/connector-kit";
import type { Principal } from "@brain/core-types";

function load(path: string): Map<string, string> {
  let parsed: unknown;
  try {
    if (process.platform !== "win32" && (statSync(path).mode & 0o077) !== 0) {
      throw new Error("file is readable by group or others; run chmod 600");
    }
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`RAG_USER_TOKENS ${path} is unreadable or not JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  const entries = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? Object.entries(parsed) : undefined;
  if (!entries || entries.some(([, token]) => typeof token !== "string" || token === "")) {
    throw new Error(`RAG_USER_TOKENS ${path} must be a JSON object of "tenant:user": "credential" strings`);
  }
  return new Map(entries as Array<[string, string]>);
}

/**
 * The live-ACL credential lookup: each user's own token at the source, keyed `tenant:user`; nobody else's is ever substituted.
 * A connector that enforces user tokens needs the file (startup fails without it, since every live check would deny);
 * one that does not (the folder connector) must not be given one, which would silently check nothing.
 */
export function userTokensFor(connector: Connector, path: string | undefined): ((principal: Principal) => string | undefined) | undefined {
  if (path === undefined) {
    if (connector.enforcesUserToken) throw new Error(`RAG_USER_TOKENS is required: connector ${connector.id} enforces user tokens`);
    return undefined;
  }
  if (!connector.enforcesUserToken) throw new Error(`RAG_USER_TOKENS is set but connector ${connector.id} does not enforce user tokens`);
  const tokens = load(path);
  return (principal) => tokens.get(`${principal.tenantId}:${principal.id}`);
}
