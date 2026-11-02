import type { Pointer, Principal } from "@brain/core-types";

export type Verdict = "allow" | "deny" | "unknown";
/** The signal aborts when the search's single deadline passes; implementations should stop work and may reject. */
export type LiveAcl = (tenantId: string, docIds: string[], principal: Principal, signal?: AbortSignal) => Promise<Map<string, Verdict>>;
/** Injected so tests control time; the service never reads the wall clock itself. */
export type Timer = { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void };
export type LiveCheck = { allowed: Set<string>; denied: number; unverified: number };

export const realTimer: Timer = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as NodeJS.Timeout) };

/** Ask the live source about a batch. Only an explicit "allow" keeps a hit; everything else fails closed. */
export async function liveCheck(verify: LiveAcl, signal: AbortSignal, principal: Principal, batch: Pointer[]): Promise<LiveCheck> {
  const ids = batch.map((p) => p.id);
  let verdicts: unknown;
  if (!signal.aborted) {
    let onAbort: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error("live acl deadline"));
        signal.addEventListener("abort", onAbort, { once: true });
      });
      verdicts = await Promise.race([Promise.resolve().then(() => verify(principal.tenantId, ids, principal, signal)), aborted]);
    } catch {
      verdicts = undefined;
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  }
  const result: LiveCheck = { allowed: new Set(), denied: 0, unverified: 0 };
  for (const id of ids) {
    const verdict = verdicts instanceof Map ? verdicts.get(id) : undefined;
    if (verdict === "allow") result.allowed.add(id);
    else if (verdict === "deny") result.denied++;
    else result.unverified++;
  }
  return result;
}

export type Verified = LiveCheck & { halt: boolean };

/**
 * Verifies a page in steps of at most `need` hits (how many more the search still wants), so a long page costs only as
 * many source reads as the search needs. `halt` is true when a step produced no verdict at all: the verifier is down or
 * the deadline passed, so asking about further pages would only repeat the failure.
 */
export async function verifyNeeded(verify: LiveAcl, signal: AbortSignal, principal: Principal, batch: Pointer[], need: number): Promise<Verified> {
  const total: Verified = { allowed: new Set(), denied: 0, unverified: 0, halt: false };
  for (let at = 0; at < batch.length && total.allowed.size < need; ) {
    const step = batch.slice(at, at + need - total.allowed.size);
    at += step.length;
    const check = await liveCheck(verify, signal, principal, step);
    for (const id of check.allowed) total.allowed.add(id);
    total.denied += check.denied;
    total.unverified += check.unverified;
    if (check.allowed.size + check.denied === 0) {
      total.halt = true;
      break;
    }
  }
  return total;
}
