import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeyedLock } from "../../src/state/lock.js";
import { doc, setup, withSink } from "../helpers.js";

const gate = () => {
  let open!: () => void;
  const p = new Promise<void>((r) => {
    open = r;
  });
  return { p, open };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

afterEach(() => vi.restoreAllMocks());

describe("createKeyedLock", () => {
  it("runs same-key tasks in order, even when one is queued after an earlier one finished", async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    const g = gate();
    const t1 = lock("k", async () => void log.push("1"));
    const t2 = lock("k", async () => {
      await g.p;
      log.push("2");
    });
    await t1;
    const t3 = lock("k", async () => void log.push("3"));
    await tick();
    expect(log).toEqual(["1"]);
    g.open();
    await Promise.all([t2, t3]);
    expect(log).toEqual(["1", "2", "3"]);
  });

  it("lets different keys run at once", async () => {
    const lock = createKeyedLock();
    const g = gate();
    const a = lock("a", () => g.p);
    await expect(lock("b", async () => "b")).resolves.toBe("b");
    g.open();
    await a;
  });

  it("keeps working after a failed task and still reports its error", async () => {
    const lock = createKeyedLock();
    const bad = lock("k", async () => {
      throw new Error("no");
    });
    await expect(bad).rejects.toThrow("no");
    await expect(lock("k", async () => 7)).resolves.toBe(7);
  });

  it("forgets a key once its last task is done", async () => {
    const del = vi.spyOn(Map.prototype, "delete");
    const lock = createKeyedLock();
    await lock("k", async () => 1);
    await tick();
    // Map.prototype is global: unrelated Map deletes under load must not count.
    expect(del.mock.calls.filter(([key]) => key === "k")).toHaveLength(1);
  });
});

describe("runtime locking", () => {
  it("does not make different tenants wait for each other", async () => {
    const s = setup([doc("a")]);
    const g = gate();
    const rt = withSink(s, async (e) => {
      if (e.tenantId === "t1") await g.p;
      else g.open();
    });
    const first = rt.runOnce("t1");
    await rt.runOnce("t2");
    await first;
  });
});
