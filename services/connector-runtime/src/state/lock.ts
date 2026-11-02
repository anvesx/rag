/** Runs tasks with the same key one after another; different keys run freely. */
export type KeyedLock = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createKeyedLock(): KeyedLock {
  const tails = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const run = (tails.get(key) ?? Promise.resolve()).then(task);
    const tail = run.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}
