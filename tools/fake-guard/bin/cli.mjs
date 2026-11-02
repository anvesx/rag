#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compare, snapshot } from "../src/baseline.ts";
import { scanRepo } from "../src/scan.ts";

const root = resolve(process.argv.includes("--root") ? process.argv[process.argv.indexOf("--root") + 1] : process.cwd());
const path = join(root, "fake-baseline.json");
const { findings, checked } = scanRepo(root);

if (process.argv.includes("--init")) {
  writeFileSync(path, `${JSON.stringify(snapshot(findings), null, 2)}\n`);
  console.log(`wrote ${path}: ${findings.length} findings`);
} else {
  const baseline = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const problems = compare(findings, baseline);
  for (const p of problems) console.log(p);
  console.log(`checked ${checked} files, ${findings.length} findings, ${Object.keys(baseline).length} baselined`);
  process.exitCode = checked === 0 ? 2 : problems.length > 0 ? 1 : 0;
}
