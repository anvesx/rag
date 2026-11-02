import { execFile, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { cleanFixtures, fixture, packageJson } from "../unit/fixture.js";

afterEach(cleanFixtures);
const cli = resolve("bin/cli.mjs");
const run = (root: string) => spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" });
const runAsync = promisify(execFile);
const base = (name: string) => ({
  [`features/${name}/package.json`]: packageJson(`@brain/${name}`),
  [`features/${name}/README.md`]: "# package",
  [`features/${name}/src/README.md`]: "# source",
  [`features/${name}/tests/.keep`]: "",
});

describe("structure-lint CLI", () => {
  it("prints all four rule violations and exits one", () => {
    const crowded = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`features/two/src/many/${index}.ts`, ""]));
    const root = fixture({
      ...base("core-types"),
      ...base("one"),
      ...base("two"),
      ...crowded,
      "features/one/src/long.ts": Array(81).fill("x").join("\n"),
      "features/one/src/missing/code.ts": "",
      "features/two/src/many/README.md": "# source",
      "features/two/package.json": packageJson("@brain/two", { "@brain/one": "workspace:*" }),
    });
    const result = run(root);
    expect(result.status).toBe(1);
    for (const rule of ["lines", "fanout", "layout", "tiers"]) expect(result.stdout).toContain(`:${rule}:`);
    expect(result.stdout).toMatch(/checked 3 packages, \d+ files/);
  });

  it("exits two when no packages exist", () => {
    const result = run(fixture({ "README.md": "empty" }));
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("checked 0 packages, 0 files");
  });

  it("runs concurrently on a valid fixture and on the real repository", async () => {
    const root = fixture(base("core-types"));
    const outputs = await Promise.all([root, root].map((path) => runAsync(process.execPath, [cli, "--root", path], { encoding: "utf8" })));
    expect(outputs.every(({ stdout }) => stdout.includes("checked 1 packages"))).toBe(true);
    const real = run(resolve("../.."));
    expect(real.status).toBe(0);
    expect(real.stdout).toMatch(/checked \d+ packages, \d+ files/);
  });
});
