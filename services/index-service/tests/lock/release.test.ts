import { describe, expect, it } from "vitest";
import { createKeyedLock } from "../../src/pipeline/lock.js";

const tick = () => new Promise((r) => setTimeout(r, 5));
const settle = () => new Promise((r) => setTimeout(r, 10));

describe("keyed lock release", () => {
  it("holds no key once its tasks settle, success or failure", async () => {
    const lock = createKeyedLock();
    expect(lock.pending()).toBe(0);
    await lock("a", async () => 1);
    await expect(lock("b", () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await settle();
    expect(lock.pending()).toBe(0);
  });

  it("keeps the key held while a queued task is still waiting", async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    const first = lock("k", async () => {
      await tick();
      log.push("first");
    });
    let open = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const second = lock("k", async () => {
      await gate;
      log.push("second");
    });
    await first;
    await settle();
    expect(lock.pending()).toBe(1);
    // A third caller arriving while `second` runs must queue behind it, not slip past.
    const third = lock("k", async () => void log.push("third"));
    open();
    await Promise.all([second, third]);
    expect(log).toEqual(["first", "second", "third"]);
    await settle();
    expect(lock.pending()).toBe(0);
  });

  it("runs a key again immediately after it was released", async () => {
    const lock = createKeyedLock();
    await lock("k", async () => 1);
    await settle();
    await expect(lock("k", async () => 2)).resolves.toBe(2);
  });
});
