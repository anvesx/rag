import { describe, expect, it } from "vitest";
import { isAllowed } from "../../src/index.js";
import { acl } from "../helpers.js";

const p = (id: string, groups: string[] = [], tenantId = "t1") => ({ id, tenantId, groups });

describe("isAllowed truth table", () => {
  const cases: [string, ReturnType<typeof p>, ReturnType<typeof acl>, string, boolean][] = [
    ["user listed", p("u"), acl(["u"], []), "t1", true],
    ["group listed", p("x", ["g"]), acl([], ["g"]), "t1", true],
    ["both listed", p("u", ["g"]), acl(["u"], ["g"]), "t1", true],
    ["neither listed", p("x", ["h"]), acl(["u"], ["g"]), "t1", false],
    ["empty lists deny", p("u", ["g"]), acl([], []), "t1", false],
    ["no groups, unlisted id", p("x"), acl(["u"], ["g"]), "t1", false],
    ["tenant mismatch, user listed", p("u"), acl(["u"], []), "t2", false],
    ["tenant mismatch, group listed", p("x", ["g"]), acl([], ["g"]), "t2", false],
    ["case sensitive", p("U"), acl(["u"], []), "t1", false],
    ["unicode id", p("ü😀"), acl(["ü😀"], []), "t1", true],
    ["group id equal to user entry does not match", p("x", ["u"]), acl(["u"], []), "t1", false],
    ["user id equal to group entry does not match", p("g"), acl([], ["g"]), "t1", false],
    [
      "1000 groups, last one listed",
      p(
        "x",
        Array.from({ length: 1000 }, (_, i) => `g${i}`),
      ),
      acl([], ["g999"]),
      "t1",
      true,
    ],
  ];
  it.each(cases)("%s", (_n, pr, a, tenant, want) => {
    expect(isAllowed(pr, a, tenant)).toBe(want);
  });
});
