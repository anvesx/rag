import { describe, expect, it } from "vitest";
import { doc, setup, tmpDb } from "../helpers.js";

const withAcl = (users: string[], groups: string[] = [], version = 1) => ({ ...doc("a"), acl: { allowUsers: users, allowGroups: groups, version } });

describe("event identity includes the ACL", () => {
  it("same version, changed ACL emits one more event", async () => {
    const dbPath = tmpDb();
    await setup([withAcl(["u1"])], dbPath).runtime.runOnce("t1");
    const second = setup([withAcl(["u1", "u2"])], dbPath);
    expect(await second.runtime.runOnce("t1")).toMatchObject({ emitted: 1, skipped: 0 });
    expect(second.events).toHaveLength(1);
  });

  it("group and acl version changes also emit", async () => {
    const dbPath = tmpDb();
    await setup([withAcl(["u1"])], dbPath).runtime.runOnce("t1");
    expect((await setup([withAcl(["u1"], ["g"])], dbPath).runtime.runOnce("t1")).emitted).toBe(1);
    expect((await setup([withAcl(["u1"], ["g"], 2)], dbPath).runtime.runOnce("t1")).emitted).toBe(1);
  });

  it("reordered or duplicated ACL entries are not a change", async () => {
    const dbPath = tmpDb();
    await setup([withAcl(["u1", "u2"], ["g1", "g2"])], dbPath).runtime.runOnce("t1");
    const second = setup([withAcl(["u2", "u1", "u1"], ["g2", "g1"])], dbPath);
    expect(await second.runtime.runOnce("t1")).toMatchObject({ emitted: 0, skipped: 1 });
  });
});
