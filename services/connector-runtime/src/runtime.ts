import { ConnectorError } from "@anvesx/connector-kit";
import type { CursorStore } from "@rag/change-cursor";
import { createDeliver } from "./deliver.js";
import { RuntimeError } from "./errors.js";
import { createKeyedLock, type KeyedLock } from "./state/lock.js";
import type { ConnectorRuntime, RunResult, RuntimeDeps } from "./types.js";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_ATTEMPTS = 3;
const MAX_ATTEMPTS = 20;
/** One lock per cursor store, so runtimes built over the same store still exclude each other. */
const locks = new WeakMap<CursorStore, KeyedLock>();

const intIn = (name: string, v: number, max: number) => {
  if (!Number.isInteger(v) || v < 1 || v > max) throw new RuntimeError("INVALID_INPUT", `${name} must be an integer in 1-${max}`);
  return v;
};

export function createConnectorRuntime(deps: RuntimeDeps): ConnectorRuntime {
  const { connector, cursors } = deps;
  const limit = intIn("pageSize", deps.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxAttempts = intIn("maxAttempts", deps.maxAttempts ?? DEFAULT_ATTEMPTS, MAX_ATTEMPTS);
  const { deliver, quarantined } = createDeliver({ ...deps, maxAttempts });
  const lock = locks.get(cursors) ?? locks.set(cursors, createKeyedLock()).get(cursors)!;

  // After a failed item the cursor is reset to the start and no longer advances, but later items and pages
  // still run, so one bad document cannot block the rest. The next run re-lists everything (seen() drops
  // the delivered items) and so still sees the whole listing, which delete detection needs.
  async function scan(tenantId: string, tally: RunResult): Promise<void> {
    let cursor = cursors.getCursor(tenantId, connector.id) ?? "";
    let held = false;
    for (;;) {
      const page = await connector.list(cursor === "" ? { limit } : { cursor, limit });
      for (const item of page.items) {
        if ((await deliver(tenantId, item, tally)) === "failed" && !held) {
          held = true;
          cursors.setCursor(tenantId, connector.id, "");
        }
      }
      cursor = page.nextCursor ?? "";
      if (!held) cursors.setCursor(tenantId, connector.id, cursor);
      if (cursor === "") return;
    }
  }

  async function run(tenantId: string): Promise<RunResult> {
    const tally: RunResult = { emitted: 0, skipped: 0, restarted: false, failures: [], quarantined: [] };
    for (;;) {
      try {
        await scan(tenantId, tally);
        tally.quarantined = quarantined(tenantId);
        return tally;
      } catch (error) {
        if (!(error instanceof ConnectorError) || error.code !== "BAD_CURSOR") throw error;
        if (tally.restarted) throw new RuntimeError("BAD_CURSOR_LOOP", "BAD_CURSOR after full restart", { cause: error });
        tally.restarted = true;
        cursors.setCursor(tenantId, connector.id, "");
      }
    }
  }

  return {
    async runOnce(tenantId) {
      if (typeof tenantId !== "string" || tenantId.length === 0) {
        throw new RuntimeError("INVALID_INPUT", "tenantId must be a non-empty string");
      }
      return lock(JSON.stringify([connector.id, tenantId]), () => run(tenantId));
    },
  };
}
