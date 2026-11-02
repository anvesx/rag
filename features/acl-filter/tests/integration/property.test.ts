import fc from "fast-check";
import { describe, it } from "vitest";
import { isAllowed } from "../../src/index.js";
import { sqlAllows } from "../helpers.js";

const pool = ["a", "b", "c", "o'x", "%", "_", "ü", "😀", "t1", "t2"];
const id = fc.oneof(fc.constantFrom(...pool), fc.string({ unit: "grapheme", minLength: 1, maxLength: 6 }));
const ids = fc.array(id, { maxLength: 6 });

describe("SQL equals isAllowed", () => {
  it("holds for random principals and ACLs (1000 runs)", () => {
    fc.assert(
      fc.property(id, id, ids, ids, ids, id, (pid, tenantId, groups, users, grps, rowTenant) => {
        const principal = { id: pid, tenantId, groups };
        const acl = { allowUsers: users, allowGroups: grps, version: 1 };
        const js = isAllowed(principal, acl, rowTenant);
        return sqlAllows(principal, { tenant: rowTenant, acl }) === js;
      }),
      { numRuns: 1000 },
    );
  });
});
