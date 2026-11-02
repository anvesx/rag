import type { Timers } from "../../src/http/limits.js";

/** Deterministic Timers: nothing fires until advance() moves the fake clock past a deadline. */
export function fakeTimers(): Timers & { advance(ms: number): void; pending(): number } {
  let now = 0;
  let seq = 0;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimeout(fn, ms) {
      jobs.set(++seq, { at: now + ms, fn });
      return seq;
    },
    clearTimeout(handle) {
      jobs.delete(handle as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, job] of [...jobs]) {
        if (job.at <= now && jobs.delete(id)) job.fn();
      }
    },
    pending: () => jobs.size,
  };
}
