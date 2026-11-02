import { describe, expect, it } from "vitest";
import { scanFile } from "../../src/rules.ts";

const MOCK = `vi${"."}mock("x")`;
const rules = (file: string, text: string) => scanFile(file, text).map((f) => f.rule);

describe("scanFile", () => {
  it("flags a fake shipped from src by file name and by export", () => {
    expect(rules("/features/a/src/fake.ts", "export const x = 1")).toEqual(["src-ships-fake"]);
    expect(rules("/features/a/src/x.ts", "export const makeFakeStore = 1")).toEqual(["src-ships-fake"]);
  });
  it("flags module mocking in any test", () => {
    expect(scanFile("/features/a/tests/unit/x.test.ts", `a\n${MOCK}`)).toEqual([{ file: "/features/a/tests/unit/x.test.ts", rule: "mocks-own-code", line: 2 }]);
  });
  it("flags memory databases and fake words only in real tiers", () => {
    const text = 'new Db(":memory:"); const fakeClock = 1';
    expect(rules("/features/a/tests/integration/x.test.ts", text).sort()).toEqual(["fake-in-real-tier", "memory-db-in-real-tier"]);
    expect(rules("/features/a/tests/unit/x.test.ts", text)).toEqual([]);
  });
  it("passes clean code", () => {
    expect(rules("/features/a/src/store.ts", "export const open = 1")).toEqual([]);
    expect(rules("/features/a/tests/integration/x.test.ts", "const db = tmpFile()")).toEqual([]);
  });
});
