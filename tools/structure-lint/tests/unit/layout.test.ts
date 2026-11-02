import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codeFiles, displayPath, findPackages, lintDirectories, StructureLintError } from "../../src/fs/walk.ts";
import { checkLayout } from "../../src/layout.ts";
import { cleanFixtures, fixture } from "./fixture.js";

afterEach(cleanFixtures);

describe("package layout rule", () => {
  it("accepts required package paths and source README files", () => {
    const root = fixture({
      "pkg/README.md": "# pkg",
      "pkg/src/README.md": "# src",
      "pkg/src/nested/README.md": "# nested",
      "pkg/tests/.keep": "",
    });
    expect(checkLayout(root, [join(root, "pkg")])).toEqual([]);
  });

  it("reports every missing package path and nested source README", () => {
    const root = fixture({ "pkg/src/nested/code.ts": "" });
    const found = checkLayout(root, [join(root, "pkg")]);
    expect(found.map((item) => item.message)).toEqual([
      "package README.md is missing",
      "package tests directory is missing",
      "source folder README.md is missing",
      "source folder README.md is missing",
    ]);
    expect(found.every((item) => item.rule === "layout")).toBe(true);
  });

  it("reports a missing source directory once", () => {
    const root = fixture({ "pkg/README.md": "", "pkg/tests/.keep": "" });
    expect(checkLayout(root, [join(root, "pkg")])).toEqual([
      {
        file: "pkg/src",
        rule: "layout",
        message: "package src directory is missing",
      },
    ]);
  });
});

describe("repository walking", () => {
  it("discovers package directories and tiers only", () => {
    const root = fixture({
      "features/f/package.json": "{}",
      "services/s/package.json": "{}",
      "modules/m/package.json": "{}",
      "apps/a/package.json": "{}",
      "tools/t/package.json": "{}",
      "features/no-package/file.ts": "",
      "features/file": "",
    });
    expect(findPackages(root).map(({ tier }) => tier)).toEqual(["feature", "service", "module", "app", "tool"]);
    expect(findPackages(join(root, "absent"))).toEqual([]);
  });

  it("returns code files, lint directories, display paths, and typed errors", () => {
    const root = fixture({
      "pkg/src/a.ts": "",
      "pkg/src/nested/b.mjs": "",
      "pkg/src/README.md": "",
      "pkg/tests/unit/c.ts": "",
    });
    expect(codeFiles(join(root, "pkg"))).toHaveLength(3);
    expect(lintDirectories(join(root, "pkg"))).toHaveLength(4);
    expect(displayPath(root, root)).toBe(".");
    expect(new StructureLintError("bad").name).toBe("StructureLintError");
  });
});
