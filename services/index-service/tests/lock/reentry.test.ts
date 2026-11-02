import { describe, expect, it } from "vitest";
import { createKeyedLock } from "../../src/pipeline/lock.js";

const tick = () => new Promise((r) => setTimeout(r, 5));
const never = () => new Promise<never>(() => undefined);
const settle = () => new Promise((r) => setTimeout(r, 10));

describe("keyed lock timeout and reentry", () => {
  it("has no timeout: a hung task blocks its key but never other keys", async () => {
    const lock = createKeyedLock();
    let ran = false;
    void lock("stuck", never);
    void lock("stuck", async () => {
      ran = true;
    });
    await expect(lock("free", async () => "ok")).resolves.toBe("ok");
    await settle();
    expect(ran).toBe(false);
    expect(lock.pending()).toBe(1);
  });

  it("a same-key call made inside a task, not awaited, runs after that task ends", async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    let inner: Promise<unknown> = Promise.resolve();
    await lock("k", async () => {
      inner = lock("k", async () => void log.push("inner"));
      await tick();
      log.push("outer");
    });
    await inner;
    expect(log).toEqual(["outer", "inner"]);
  });

  it("a different-key call awaited inside a task completes", async () => {
    const lock = createKeyedLock();
    await expect(lock("a", () => lock("b", async () => "deep"))).resolves.toBe("deep");
  });

  it("a rejected task does not block queued tasks and each caller sees its own result", async () => {
    const lock = createKeyedLock();
    const bad = lock("k", () => Promise.reject(new Error("boom")));
    const good = lock("k", async () => "fine");
    await expect(bad).rejects.toThrow("boom");
    await expect(good).resolves.toBe("fine");
  });
});
