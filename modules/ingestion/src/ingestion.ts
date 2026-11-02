import { contentHash } from "@brain/connector-kit";
import { type ChangeEvent, createConnectorRuntime, createKeyedLock } from "@rag/connector-runtime";
import { IngestionError } from "./errors.js";
import { reapSkip } from "./pipeline/guard.js";
import { watchListing } from "./pipeline/listing.js";
import { docId, toPointer } from "./pipeline/pointer.js";
import { reap } from "./pipeline/reap.js";
import type { Ingestion, IngestionCounts, IngestionDeps } from "./types.js";

export function createIngestion({ runtime, indexService, connectorFor, tokenFor, known: seed, reapGuard, warn }: IngestionDeps): Ingestion {
  /** tenant -> (pointer id -> address) of documents this process indexed and has not deleted. */
  const known = new Map<string, Map<string, string>>();
  const knownFor = (tenantId: string) => known.get(tenantId) ?? known.set(tenantId, new Map()).get(tenantId)!;
  const lock = createKeyedLock();

  async function run(tenantId: string, connector: NonNullable<ReturnType<typeof connectorFor>>, token: string) {
    const counts: IngestionCounts = { emitted: 0, indexed: 0, failed: 0, failures: [], quarantined: [] };
    const { watched, listed, sawEverything } = watchListing(connector);
    const sink = async (event: ChangeEvent) => {
      counts.emitted++;
      try {
        const meta = listed.get(event.address);
        if (!meta) throw new Error(`no listing for ${event.address}`);
        const { text } = await connector.fetch(event.address, { token });
        const hash = contentHash(text);
        const pointer = toPointer(event, meta, hash);
        // The index gets the text we already fetched, so it does not fetch the document a second time.
        const result = await indexService.apply({ type: "upsert", pointer, content: { text, contentHash: hash } });
        knownFor(tenantId).set(pointer.id, event.address);
        if (result.outcome !== "unchanged") counts.indexed++;
      } catch (error) {
        counts.failed++;
        throw error;
      }
    };
    const result = await createConnectorRuntime({ ...runtime, connector: watched, sink }).runOnce(tenantId);
    counts.failures.push(...result.failures);
    counts.quarantined = result.quarantined;
    // Failed documents do not stop a full listing, so deletes are still detected.
    if (sawEverything()) {
      const mine = knownFor(tenantId);
      // Ids known only from the seed have no address; the id stands in for it in failure reports.
      for (const id of seed ? await seed(tenantId) : []) if (!mine.has(id)) mine.set(id, id);
      const listedIds = new Set([...listed.keys()].map((address) => docId(connector.id, address)));
      const skipped = reapSkip(mine, listedIds, reapGuard);
      if (skipped) {
        counts.reapSkipped = skipped;
        warn?.("reap skipped", { tenantId, ...skipped });
      } else await reap(indexService, tenantId, new Date(runtime.clock()).toISOString(), mine, listedIds, counts);
    }
    return counts;
  }

  return {
    async runOnce(tenantId) {
      const connector = connectorFor(tenantId);
      const token = tokenFor(tenantId);
      if (!connector || token === undefined) throw new IngestionError("UNKNOWN_TENANT", `no connector or credential bound to tenant ${tenantId}`);
      return lock(tenantId, () => run(tenantId, connector, token));
    },
  };
}
