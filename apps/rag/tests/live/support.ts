import { type Connector, ConnectorError } from "@anvesx/connector-kit";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { docs } from "../fixtures.js";

/** Who the source lets read each address. Mutable: change it to simulate a revocation at the source. */
export type Grants = Map<string, string[]>;

/**
 * A connector that, like a real source, checks the caller's token. Tokens are `user-<id>`; any other token
 * (the tenant's service credential used by ingestion) may read everything. A denied read looks like NOT_FOUND.
 */
export function guarded(grants: Grants, hang: Set<string> = new Set(), broken: Set<string> = new Set()): Connector & { calls: Array<[string, string]> } {
  const inner = createFakeConnector("fake", docs());
  const calls: Array<[string, string]> = [];
  return {
    id: inner.id,
    enforcesUserToken: true,
    calls,
    list: (query) => inner.list(query),
    async fetch(address, { token }) {
      calls.push([address, token]);
      if (!token.startsWith("user-")) return inner.fetch(address, { token });
      if (hang.has(address)) return new Promise(() => undefined);
      if (broken.has(address)) throw new Error("source unavailable");
      if (!grants.get(address)?.includes(token.slice(5))) throw new ConnectorError("NOT_FOUND", address);
      return inner.fetch(address, { token });
    },
  };
}

export const defaultGrants = (): Grants =>
  new Map([
    ["a", ["alice"]],
    ["b", ["alice"]],
    ["hidden", ["bob"]],
  ]);
