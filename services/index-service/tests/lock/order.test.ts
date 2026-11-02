import { describe, expect, it } from "vitest";
import { createKeyedLock } from "../../src/pipeline/lock.js";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("keyed lock", () => {
  it("runs same-key tasks in order", async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    const a = lock("k", async () => {
      await tick();
      log.push("a");
    });
    const b = lock("k", async () => {
      log.push("b");
    });
    await Promise.all([a, b]);
    expect(log).toEqual(["a", "b"]);
  });

  it("does not block other keys", async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    const a = lock("k1", async () => {
      await tick();
      log.push("a");
    });
    const b = lock("k2", async () => {
      log.push("b");
    });
    await Promise.all([a, b]);
    expect(log).toEqual(["b", "a"]);
  });

  it("continues after a rejection and returns values", async () => {
    const lock = createKeyedLock();
    await expect(
      lock("k", async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");
    await expect(lock("k", async () => 7)).resolves.toBe(7);
  });
});
