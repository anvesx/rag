import { describe, expect, it } from "vitest";
import { createIngestion } from "../../src/index.js";
import { doc, setup } from "../support/harness.js";

describe("run counts", () => {
  it("a clean run reports empty failure and quarantine lists", async () => {
    const s = setup([doc("a")]);
    expect(await s.ingestion.runOnce("acme")).toEqual({ emitted: 1, indexed: 1, failed: 0, failures: [], quarantined: [] });
  });

  it("a retried event that the index already holds is emitted but not counted as indexed", async () => {
    let late = true;
    const s = setup([doc("a")], (svc) => ({
      ...svc,
      apply: async (change) => {
        const r = await svc.apply(change);
        if (late) throw new Error("late");
        return r;
      },
    }));
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ emitted: 1, indexed: 0, failed: 1 });
    late = false;
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ emitted: 1, indexed: 0, failed: 0 });
  });

  it("a run resumed from a saved cursor does not tombstone documents it never listed", async () => {
    const s = setup([doc("a"), doc("b"), doc("c")]);
    const list = s.connector.list.bind(s.connector);
    let calls = 0;
    s.connector.list = async (q) => {
      if (++calls === 2) throw new Error("connection lost");
      return list(q);
    };
    await expect(s.ingestion.runOnce("acme")).rejects.toThrow("connection lost");
    s.set([doc("b"), doc("z"), doc("c")]);
    await s.ingestion.runOnce("acme");
    expect(s.rows().map((p) => p.address)).toContain("a");
  });
});

describe("tenant binding", () => {
  const bound = (connector: boolean, token: boolean) => {
    const s = setup([]);
    return createIngestion({
      runtime: { cursors: s.cursors, clock: () => 1 },
      connectorFor: () => (connector ? s.connector : undefined),
      tokenFor: () => (token ? "tok" : undefined),
      indexService: {} as never,
    });
  };

  it("needs both a connector and a credential, and names the tenant in the error", async () => {
    for (const [c, t] of [
      [false, true],
      [true, false],
      [false, false],
    ] as const) {
      await expect(bound(c, t).runOnce("globex")).rejects.toMatchObject({
        code: "UNKNOWN_TENANT",
        message: "no connector or credential bound to tenant globex",
      });
    }
  });
});
