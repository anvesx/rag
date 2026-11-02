import { describe, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";
import { ptr } from "../fixtures.js";

describe("ACL set equality", () => {
  it("ids containing a NUL byte are not conflated", () => {
    const r = createRegistry(":memory:");
    const mk = (u: string[]) => ptr({ acl: { allowUsers: u, allowGroups: [], version: 1 } });
    r.upsert(mk(["a\0b", "c"]));
    expect(r.upsert(mk(["a", "b\0c"])).change).toBe("updated");
  });
});
