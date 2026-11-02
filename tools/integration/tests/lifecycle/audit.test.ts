import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createSource, doc, openStack, principal, scratch, tamper } from "../../src/index.js";

const tmp = scratch();
afterEach(tmp.cleanup);
const alice = principal("alice", "t1");

async function searched(n: number) {
  const stack = openStack(tmp.make(), { t1: createSource([doc("a", ["alice"])]) });
  await stack.ingest("t1");
  for (let i = 0; i < n; i++) await stack.search(alice, `needle ${i}`);
  return stack;
}

describe("audit chain", () => {
  it("verifies after N searches, one row each", async () => {
    const stack = await searched(7);
    expect(await stack.verify("t1")).toEqual({ status: "ok" });
    const h = new DatabaseSync(stack.auditDbPath);
    expect((h.prepare("SELECT count(*) AS n FROM audit WHERE tenant_id = 't1'").get() as { n: number }).n).toBe(7);
    h.close();
    stack.close();
  });

  it("detects an edited row", async () => {
    const stack = await searched(4);
    tamper(stack.auditDbPath, "UPDATE audit SET actor = 'evil' WHERE seq = 2");
    expect(await stack.verify("t1")).toEqual({ status: "mismatch", brokenAt: 2 });
    stack.close();
  });

  it("detects truncation once checkpointed", async () => {
    const stack = await searched(3);
    await stack.checkpoint("t1");
    tamper(stack.auditDbPath, "DELETE FROM audit WHERE seq = 3");
    expect(await stack.verify("t1")).toEqual({ status: "truncated", brokenAt: 3 });
    stack.close();
  });

  it("keeps tenants' chains independent", async () => {
    const stack = await searched(2);
    expect(await stack.verify("t2")).toEqual({ status: "ok" });
    stack.close();
  });
});
