import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Finding, scanFile } from "./rules.ts";

const files = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? e.name === "node_modules" || e.name === "dist"
            ? []
            : files(join(dir, e.name))
          : /\.(ts|mjs)$/.test(e.name)
            ? [join(dir, e.name)]
            : [],
      )
    : [];

export const packageDirs = (root: string): string[] =>
  ["features", "services", "modules", "apps", "tools"].flatMap((tier) =>
    existsSync(join(root, tier))
      ? readdirSync(join(root, tier), { withFileTypes: true })
          .filter((e) => e.isDirectory() && existsSync(join(root, tier, e.name, "package.json")))
          .map((e) => join(root, tier, e.name))
      : [],
  );

/** Scans every package's src and tests; returns the findings and how many files were checked. */
export const scanRepo = (root: string): { findings: Finding[]; checked: number } => {
  const all = packageDirs(root).flatMap((pkg) => ["src", "tests"].flatMap((d) => files(join(pkg, d))));
  const findings = all.flatMap((abs) => {
    const rel = `/${relative(root, abs)}`;
    return scanFile(rel, readFileSync(abs, "utf8")).map((f) => ({ ...f, file: f.file.slice(1) }));
  });
  return { findings, checked: all.length };
};
