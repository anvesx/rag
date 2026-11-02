import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkFanout } from "../../src/fanout.ts";
import { cleanFixtures, fixture } from "./fixture.js";

afterEach(cleanFixtures);

describe("folder fanout rule", () => {
  it("accepts five files in each independently counted folder", () => {
    const files = Object.fromEntries(
      ["src/a", "tests/unit"].flatMap((dir) => Array.from({ length: 5 }, (_, index) => [`pkg/${dir}/${index}.${index === 4 ? "mjs" : "ts"}`, ""])),
    );
    const root = fixture({ ...files, "pkg/src/a/README.md": "", "pkg/src/a/child/code.ts": "" });
    expect(checkFanout(root, [join(root, "pkg")])).toEqual([]);
  });

  it("reports six files but does not count nested files in the parent", () => {
    const files = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`pkg/src/nested/${index}.ts`, ""]));
    const root = fixture({ ...files, "pkg/src/only.ts": "" });
    const found = checkFanout(root, [join(root, "pkg")]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: "fanout", message: "6 files exceeds 5" });
  });

  it("counts every non-README file, including non-code files", () => {
    const files = Object.fromEntries(["a.json", "b.txt", "c.ts", "d.md", "e", ".f"].map((name) => [`pkg/tests/unit/${name}`, ""]));
    const root = fixture({ ...files, "pkg/tests/unit/README.md": "" });
    expect(checkFanout(root, [join(root, "pkg")])).toHaveLength(1);
  });
});
