import type { Pointer } from "@anvesx/core-types";
import type { RagDeps } from "../types.js";

/** `deps.fetchText` when given; otherwise reads the pointer's address through its tenant's connector with the tenant credential. */
export function textFetcher(deps: Pick<RagDeps, "fetchText" | "connectorFor" | "tokenFor">): (pointer: Pointer) => Promise<string> {
  if (deps.fetchText) return deps.fetchText;
  return async ({ tenantId, address }) => {
    const connector = deps.connectorFor(tenantId);
    const token = deps.tokenFor(tenantId);
    if (!connector || token === undefined) throw new Error(`no connector or credential for tenant ${tenantId}`);
    return (await connector.fetch(address, { token })).text;
  };
}
