import { ConnectorError } from "@brain/connector-kit";
import { doc, scratch } from "../../src/fixtures.js";
import { createSource, type Source } from "../../src/source.js";
import { openStack, type Stack } from "../../src/stack.js";

export const dirs = scratch();

/** What the source does to a user's read of an address: refuse as not found, never answer, or fail. */
export type Behaviour = "allow" | "deny" | "hang" | "error";

/** A source that checks the caller: ingestion's credential reads everything, a `user-<id>` token reads per `behaviour`. */
export function guarded(behaviour: Map<string, Behaviour>): Source {
  const source = createSource([doc("a", ["alice"]), doc("b", ["alice"]), doc("c", ["alice"])]);
  return {
    ...source,
    enforcesUserToken: true,
    async fetch(address, opts) {
      const how = opts.token.startsWith("user-") ? (behaviour.get(address) ?? "allow") : "allow";
      if (how === "deny") throw new ConnectorError("NOT_FOUND", address);
      if (how === "hang") return new Promise(() => undefined);
      if (how === "error") throw new Error("source unavailable");
      return source.fetch(address, opts);
    },
  };
}

/** The real packages over real files with the live ACL on, ingested once. */
export async function openLive(source: Source): Promise<Stack> {
  const stack = openStack(dirs.make(), { t1: source }, { userTokenFor: (who) => `user-${who.id}`, liveAclTimeoutMs: 50 });
  await stack.ingest("t1");
  return stack;
}
