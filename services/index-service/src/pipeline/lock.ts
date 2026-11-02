export type KeyedLock = {
  <T>(key: string, task: () => Promise<T>): Promise<T>;
  /** Number of keys currently held (running or queued). Zero when idle, so the map never leaks. */
  pending(): number;
};

/** Runs tasks with the same key one at a time, in call order. Other keys run freely. There is no timeout. */
export function createKeyedLock(): KeyedLock {
  const tails = new Map<string, Promise<unknown>>();
  const lock = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const run = (tails.get(key) ?? Promise.resolve()).then(task);
    const tail = run.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
  return Object.assign(lock, { pending: () => tails.size });
}
