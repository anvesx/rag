import { DEFAULT_TIMEOUTS, type Timeouts } from "../config/ops.js";
import type { RagDeps } from "../types.js";

/** A dependency that did not answer in time. Carries a stable `code` for callers and logs. */
export class TimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Rejects with TimeoutError when `work` has not settled in `ms`. The late result is dropped; the timer never outlives the call. */
export function withTimeout<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

type Bounded = Pick<RagDeps, "embed" | "embedQuery" | "connectorFor"> & { fetchText?: RagDeps["fetchText"] };

/** The same dependencies, each external call bounded by its own timeout. */
export function bounded(deps: Bounded, given: Partial<Timeouts> = {}): Bounded {
  const t = { ...DEFAULT_TIMEOUTS, ...given };
  const { fetchText } = deps;
  return {
    embed: (texts) => withTimeout("embed", t.embedMs, deps.embed(texts)),
    embedQuery: (text) => withTimeout("embedQuery", t.embedQueryMs, deps.embedQuery(text)),
    ...(fetchText && { fetchText: (pointer) => withTimeout("fetchText", t.fetchTextMs, fetchText(pointer)) }),
    connectorFor: (tenantId) => {
      const connector = deps.connectorFor(tenantId);
      return (
        connector && {
          ...connector,
          list: (query) => withTimeout("connector.list", t.listMs, connector.list(query)),
          fetch: (address, auth) => withTimeout("fetchText", t.fetchTextMs, connector.fetch(address, auth)),
        }
      );
    },
  };
}
