import { describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { code, ptr } from "../fixtures.js";

describe("validation", () => {
  const r = createRegistry(":memory:");
  it.each([
    ["bad hash", ptr({ contentHash: "xyz" })],
    ["bad zone", { ...ptr(), zone: "nope" }],
    ["body text field", { ...ptr(), body: "secret text" }],
    ["bad date", ptr({ updatedAt: "yesterday" })],
    ["negative acl version", ptr({ acl: { allowUsers: [], allowGroups: [], version: -1 } })],
    ["address too long", ptr({ address: "x".repeat(2049) })],
  ])("%s throws INVALID", (_n, bad) => {
    expect(code(() => r.upsert(bad as never))).toBe("INVALID");
  });
  it.each([null, undefined, 42, "str", []])("non-object %j throws INVALID", (bad) => {
    expect(code(() => r.upsert(bad as never))).toBe("INVALID");
  });
  it("invalid input writes nothing", () => {
    expect(r.list({ tenantId: "t1" })).toEqual([]);
  });
  it("INVALID error carries a message and name", () => {
    try {
      r.upsert(null as never);
    } catch (e) {
      expect((e as Error).name).toBe("RegistryError");
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });
});
