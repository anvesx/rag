import type { Connector, ListedDoc } from "@brain/connector-kit";
import type { CursorStore } from "@rag/change-cursor";
import { failureStore } from "./state/failures.js";
import { eventIdOf } from "./state/identity.js";
import { pendingStore } from "./state/pending.js";
import type { RunResult, Sink } from "./types.js";

type Deps = { connector: Connector; cursors: CursorStore; sink: Sink; clock: () => number; maxAttempts: number };

/**
 * Delivers one listed item. Marker-before-seen: seen() cannot be undone, so a crash or sink failure after
 * it would lose the event. Ids whose delivery is unconfirmed sit in a pending list; a later run bypasses
 * seen() for them. Returns "failed" only for a rejection that is still retryable.
 */
export function createDeliver({ connector, cursors, sink, clock, maxAttempts }: Deps) {
  const { pending, setPending } = pendingStore(cursors, `${connector.id}#inflight`);
  const failures = failureStore(cursors, connector.id);

  return {
    quarantined: failures.quarantined,
    async deliver(tenantId: string, item: ListedDoc, tally: RunResult): Promise<"done" | "failed"> {
      const eventId = eventIdOf(connector.id, item);
      if (failures.isDead(tenantId, eventId)) {
        tally.skipped++;
        return "done";
      }
      const before = pending(tenantId);
      const others = before.filter((id) => id !== eventId);
      if (!before.includes(eventId)) {
        setPending(tenantId, [...before, eventId]);
        if (cursors.seen(tenantId, eventId)) {
          setPending(tenantId, before);
          tally.skipped++;
          return "done";
        }
      }
      try {
        await sink({ tenantId, connectorId: connector.id, address: item.address, version: item.version, title: item.title, emittedAt: clock() });
      } catch (cause) {
        const failure = { address: item.address, error: cause instanceof Error ? cause.message : String(cause) };
        tally.failures.push(failure);
        if (failures.bump(tenantId, eventId) < maxAttempts) return "failed";
        failures.bury(tenantId, eventId, failure);
        setPending(tenantId, others);
        return "done";
      }
      failures.clear(tenantId, eventId, item.address);
      setPending(tenantId, others);
      tally.emitted++;
      return "done";
    },
  };
}
