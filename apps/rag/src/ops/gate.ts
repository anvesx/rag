/** Counts in-flight work so shutdown can refuse new requests and wait for the running ones. */
export type Gate = {
  /** Runs `work`, or rejects at once once draining has begun. */
  run<T>(work: () => Promise<T>): Promise<T>;
  /** Stops admitting new work. Idempotent. */
  begin(): void;
  draining(): boolean;
  /** Resolves when nothing is in flight, or after `ms`, whichever comes first. */
  idle(ms: number): Promise<void>;
};

const FLUSH_MS = 100;

export function createGate(): Gate {
  let inflight = 0;
  let stopped = false;
  let waiters: Array<() => void> = [];
  const settle = () => {
    if (inflight > 0) return;
    for (const wake of waiters) wake();
    waiters = [];
  };
  return {
    async run(work) {
      if (stopped) throw new Error("unavailable: shutting down");
      inflight++;
      try {
        return await work();
      } finally {
        inflight--;
        settle();
      }
    },
    begin() {
      stopped = true;
    },
    draining: () => stopped,
    idle: (ms) =>
      new Promise<void>((resolve) => {
        if (inflight === 0) return resolve();
        const timer = setTimeout(resolve, ms);
        // The work is done but its HTTP response may still be in the socket buffer: give it a moment before the caller closes connections.
        waiters.push(() => {
          clearTimeout(timer);
          setTimeout(resolve, FLUSH_MS);
        });
      }),
  };
}
