import { DEFAULT_LIVE_TIMEOUT_MS, type LiveAcl } from "@rag/query-service";
import { afterEach, describe, expect, it } from "vitest";
import { rig } from "../harness.js";

const open: Array<{ close(): Promise<unknown> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close().catch(() => undefined)));
});
const ask = { query: "needle", limit: 10, principal: { id: "alice", tenantId: "t1", groups: [] } };
const hang: LiveAcl = () => new Promise(() => undefined);

/** Timer that records requested delays and fires at once, so a timeout is observable without waiting. */
function recordingTimer() {
  const delays: number[] = [];
  const cleared: unknown[] = [];
  return {
    delays,
    cleared,
    set: (fn: () => void, ms: number) => {
      delays.push(ms);
      queueMicrotask(fn);
      return delays.length;
    },
    clear: (h: unknown) => void cleared.push(h),
  };
}

async function searchWith(extra: Record<string, unknown>) {
  const r = rig();
  r.seed("a", ["alice"]);
  const h = await r.start(extra);
  open.push(h);
  return h.search(ask);
}

describe("createRetrieval forwards query-service options", () => {
  it("uses the injected timer with the configured live ACL timeout", async () => {
    const timer = recordingTimer();
    await expect(searchWith({ liveAcl: hang, liveAclTimeoutMs: 7, timer })).resolves.toEqual({ ok: false, code: "LIVE_ACL" });
    expect(timer.delays).toEqual([7]);
    expect(timer.cleared).toEqual([1]);
  });

  it("falls back to the default live ACL timeout when none is configured", async () => {
    const timer = recordingTimer();
    await searchWith({ liveAcl: hang, timer });
    expect(timer.delays).toEqual([DEFAULT_LIVE_TIMEOUT_MS]);
  });

  it("rejects an invalid candidate cap instead of ignoring it", async () => {
    const r = rig();
    await expect(r.start({ maxCandidates: 0 })).rejects.toMatchObject({ code: "CONFIG" });
  });

  it("applies a candidate cap of 1 to the scan", async () => {
    const r = rig();
    for (const id of ["a", "b"]) r.seed(id, ["alice"]);
    const h = await r.start({ maxCandidates: 1 });
    open.push(h);
    await expect(h.search(ask)).resolves.toMatchObject({ ok: true, scanned: 1, truncated: true });
  });
});
