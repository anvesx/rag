import { DEFAULT_LIVE_TIMEOUT_MS } from "@rag/query-service";
import { describe, expect, it } from "vitest";
import { start } from "../harness.js";
import { defaultGrants, guarded } from "./support.js";

const alice = { id: "alice", tenantId: "t1", groups: [] };
const hanging = () => guarded(defaultGrants(), new Set(["a", "b"]));
const live = (over: { liveAclTimeoutMs?: number }) =>
  start({
    connectorFor: (t) => (t === "t1" ? hanging() : undefined),
    tokenFor: (t) => (t === "t1" ? "token-t1" : undefined),
    userTokenFor: (p) => `user-${p.id}`,
    ...over,
  });

/** Milliseconds a search by alice takes to be rejected. */
async function rejectionTime(over: { liveAclTimeoutMs?: number }): Promise<number> {
  const { app } = await live(over);
  await app.ingest("t1");
  const began = Date.now();
  await expect(app.search({ query: "needle", principal: alice })).rejects.toMatchObject({ code: "LIVE_ACL" });
  const took = Date.now() - began;
  await app.close();
  return took;
}

describe("live ACL timeout wiring", () => {
  it("honours the configured liveAclTimeoutMs instead of the default", async () => {
    expect(await rejectionTime({ liveAclTimeoutMs: 40 })).toBeLessThan(DEFAULT_LIVE_TIMEOUT_MS / 2);
  });

  it("waits out the query-service default when none is configured", async () => {
    expect(await rejectionTime({})).toBeGreaterThanOrEqual(DEFAULT_LIVE_TIMEOUT_MS - 100);
  }, 10_000);
});
