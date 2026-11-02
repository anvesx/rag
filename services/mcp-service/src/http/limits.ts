import { McpServiceError } from "../errors.js";

export type SessionLimits = {
  /** Live plus still-initializing sessions, across all principals. */
  maxSessions: number;
  /** Per (tenantId, principal id). */
  maxSessionsPerPrincipal: number;
  /** A session with no request for this long is closed. */
  idleTimeoutMs: number;
};

/** Injected so tests can drive idle expiry with a fake clock. */
export type Timers = { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void };

export const DEFAULT_LIMITS: SessionLimits = { maxSessions: 1000, maxSessionsPerPrincipal: 20, idleTimeoutMs: 30 * 60_000 };

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export type LimitOptions = { [K in keyof SessionLimits]?: number | undefined };

export function resolveLimits(given: LimitOptions = {}): SessionLimits {
  const limits = { ...DEFAULT_LIMITS };
  for (const name of Object.keys(DEFAULT_LIMITS) as Array<keyof SessionLimits>) {
    const value = given[name] ?? DEFAULT_LIMITS[name];
    if (!(Number.isInteger(value) && value > 0)) throw new McpServiceError("INVALID_CONFIG", `${name} must be a positive integer`);
    limits[name] = value;
  }
  return limits;
}
