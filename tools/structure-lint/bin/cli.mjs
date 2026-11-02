#!/usr/bin/env node
import { resolve } from "node:path";
import { checkFanout } from "../src/fanout.ts";
import { codeFiles, findPackages, StructureLintError } from "../src/fs/walk.ts";
import { checkLayout } from "../src/layout.ts";
import { checkLines } from "../src/lines.ts";
import { checkTiers } from "../src/tiers.ts";

const rootIndex = process.argv.indexOf("--root");
if (rootIndex >= 0 && process.argv[rootIndex + 1] === undefined) {
  console.error("usage: structure-lint [--root dir]");
  process.exit(2);
}
const root = resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());

try {
  const packages = findPackages(root);
  const dirs = packages.map(({ dir }) => dir);
  const files = dirs.reduce((count, dir) => count + codeFiles(dir).length, 0);
  const violations = [...checkLines(root, dirs), ...checkFanout(root, dirs), ...checkLayout(root, dirs), ...checkTiers(root, packages)].sort((left, right) =>
    `${left.file}:${left.rule}`.localeCompare(`${right.file}:${right.rule}`),
  );
  for (const item of violations) console.log(`${item.file}:${item.rule}:${item.message}`);
  console.log(`checked ${packages.length} packages, ${files} files`);
  process.exitCode = packages.length === 0 ? 2 : violations.length > 0 ? 1 : 0;
} catch (error) {
  if (error instanceof StructureLintError) console.error(`${root}:input:${error.message}`);
  else throw error;
  process.exitCode = 1;
}
