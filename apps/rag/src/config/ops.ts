import type { Env } from "./env.js";

export type Timeouts = { embedMs: number; embedQueryMs: number; fetchTextMs: number; listMs: number };
export type OpsConfig = { timeouts: Timeouts; drainMs: number; forceExitMs: number; healthPort: number };

export const DEFAULT_TIMEOUTS: Timeouts = { embedMs: 30_000, embedQueryMs: 5_000, fetchTextMs: 30_000, listMs: 30_000 };

function millis(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d{1,9}$/.test(raw) || Number(raw) <= 0) throw new Error(`${name} must be a positive whole number of milliseconds, got ${JSON.stringify(raw)}`);
  return Number(raw);
}

/** Timeouts, shutdown windows and the health port. `servicePort` 0 (ephemeral) keeps health ephemeral too; otherwise health is the next port. */
export function readOps(env: Env, servicePort = 3000): OpsConfig {
  const port = env.RAG_HEALTH_PORT;
  if (port !== undefined && !/^\d{1,5}$/.test(port)) throw new Error(`invalid RAG_HEALTH_PORT: ${port}`);
  return {
    timeouts: {
      embedMs: millis(env, "RAG_EMBED_TIMEOUT_MS", DEFAULT_TIMEOUTS.embedMs),
      embedQueryMs: millis(env, "RAG_EMBED_QUERY_TIMEOUT_MS", DEFAULT_TIMEOUTS.embedQueryMs),
      fetchTextMs: millis(env, "RAG_FETCH_TIMEOUT_MS", DEFAULT_TIMEOUTS.fetchTextMs),
      listMs: millis(env, "RAG_LIST_TIMEOUT_MS", DEFAULT_TIMEOUTS.listMs),
    },
    drainMs: millis(env, "RAG_DRAIN_MS", 10_000),
    forceExitMs: millis(env, "RAG_FORCE_EXIT_MS", 20_000),
    healthPort: port !== undefined ? Number(port) : servicePort === 0 ? 0 : servicePort + 1,
  };
}
