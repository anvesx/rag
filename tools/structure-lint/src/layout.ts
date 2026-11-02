import { existsSync } from "node:fs";
import { join } from "node:path";
import { displayPath, type Violation, walkDirectories } from "./fs/walk.ts";

const missing = (root: string, path: string, message: string): Violation => ({
  file: displayPath(root, path),
  rule: "layout",
  message,
});

export const checkLayout = (root: string, packages: readonly string[]): Violation[] =>
  packages.flatMap((packageDir) => {
    const violations: Violation[] = [];
    const readme = join(packageDir, "README.md");
    const source = join(packageDir, "src");
    const tests = join(packageDir, "tests");
    if (!existsSync(readme)) violations.push(missing(root, readme, "package README.md is missing"));
    if (!existsSync(source)) violations.push(missing(root, source, "package src directory is missing"));
    if (!existsSync(tests)) violations.push(missing(root, tests, "package tests directory is missing"));
    for (const dir of walkDirectories(source)) {
      const path = join(dir, "README.md");
      if (!existsSync(path)) violations.push(missing(root, path, "source folder README.md is missing"));
    }
    return violations;
  });
