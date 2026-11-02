import type { Principal } from "@brain/core-types";
import { createQueryService, type LiveAcl, type Verdict } from "../src/index.js";
import { docs, grant, hit, pagedIndex, registryOf } from "./fakes.js";

export const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
export const req = (limit = 10, principal: Principal = alice) => ({ query: "x", principal, embedding: [1, 0], limit });
/** Manual timer: `fire()` runs every pending timeout callback. */
export function manualTimer() {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    pending,
    set: (fn: () => void) => {
      pending.set(++next, fn);
      return next;
    },
    clear: (h: unknown) => void pending.delete(h as number),
    fire: () => {
      for (const fn of pending.values()) fn();
    },
  };
}
export const verdicts =
  (map: Record<string, Verdict>): LiveAcl =>
  async () =>
    new Map(Object.entries(map));
export function liveRig(liveAcl?: LiveAcl, total = 6) {
  const ids = docs(total);
  const timer = manualTimer();
  const index = pagedIndex(ids.map((d) => hit(d)));
  const registry = registryOf({ ...grant(ids.slice(0, total - 1), "alice"), [ids[total - 1] ?? ""]: ["zed"] });
  const service = createQueryService({ index, registry, ...(liveAcl ? { liveAcl } : {}), timer, liveAclTimeoutMs: 50 });
  return { ids, timer, service };
}
