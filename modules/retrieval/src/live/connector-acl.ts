import { type Connector, ConnectorError } from "@brain/connector-kit";
import type { Pointer, Principal } from "@brain/core-types";
import type { LiveAcl } from "@rag/query-service";
import { RetrievalError } from "../errors.js";

export const DEFAULT_CONCURRENCY = 8;

export type ConnectorAclDeps = {
  connectorFor: (tenantId: string) => Connector | undefined;
  /** The user's own credential at the source, or undefined when they have none. Never the tenant's service credential. */
  userTokenFor: (principal: Principal) => string | undefined;
  /** The registry pointer for a document id, or undefined when it is not known. */
  pointerFor: (tenantId: string, docId: string) => Pointer | undefined;
  /** Most fetches in flight at once per call; positive integer, default 8. */
  concurrency?: number;
};

type Verdict = "allow" | "deny" | "unknown";

/**
 * A live ACL that asks the source itself: it fetches each document with the user's token. A read that succeeds is
 * "allow", NOT_FOUND and FORBIDDEN (401/403) are "deny", anything else is "unknown". Fetches run in a bounded pool and
 * stop starting once the signal aborts. A connector that does not declare `enforcesUserToken` rejects with a
 * CONFIG RetrievalError (its fetch would "allow" everything); query-service then fails closed.
 */
export function createConnectorLiveAcl({ connectorFor, userTokenFor, pointerFor, concurrency = DEFAULT_CONCURRENCY }: ConnectorAclDeps): LiveAcl {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RetrievalError("CONFIG", "concurrency must be a positive integer");
  return async (tenantId, docIds, principal, signal) => {
    const connector = connectorFor(tenantId);
    if (connector && connector.enforcesUserToken !== true) throw new RetrievalError("CONFIG", "connector does not enforce the user token");
    const token = userTokenFor(principal);
    const verdicts = new Map<string, Verdict>();
    let next = 0;
    const worker = async () => {
      while (next < docIds.length) {
        const id = docIds[next++] as string;
        const pointer = pointerFor(tenantId, id);
        const ready = connector && token && pointer && !signal?.aborted;
        verdicts.set(id, ready ? await check(connector, pointer.address, token, signal) : "unknown");
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, docIds.length) }, worker));
    return new Map(docIds.map((id) => [id, verdicts.get(id) ?? "unknown"] as const));
  };
}

async function check(connector: Connector, address: string, token: string, signal: AbortSignal | undefined): Promise<Verdict> {
  try {
    await connector.fetch(address, { token, ...(signal && { signal }) });
    return "allow";
  } catch (error) {
    return error instanceof ConnectorError && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") ? "deny" : "unknown";
  }
}
