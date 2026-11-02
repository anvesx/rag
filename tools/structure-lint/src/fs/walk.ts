import { existsSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type Tier = "feature" | "service" | "module" | "app" | "tool";
export type Violation = { file: string; rule: string; message: string };
export type PackageInfo = { dir: string; tier: Tier };

const tierFolders: ReadonlyArray<readonly [string, Tier]> = [
  ["features", "feature"],
  ["services", "service"],
  ["modules", "module"],
  ["apps", "app"],
  ["tools", "tool"],
];

export class StructureLintError extends Error {
  override readonly name = "StructureLintError";
}

export const findPackages = (root: string): PackageInfo[] =>
  tierFolders.flatMap(([folder, tier]) => {
    const parent = join(root, folder);
    if (!existsSync(parent)) return [];
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(parent, entry.name, "package.json")))
      .map((entry) => ({ dir: join(parent, entry.name), tier }));
  });

export const walkDirectories = (root: string): string[] => {
  if (!existsSync(root)) return [];
  const found = [root];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...walkDirectories(join(root, entry.name)));
  }
  return found;
};

export const codeFiles = (packageDir: string): string[] =>
  ["src", "tests"].flatMap((folder) =>
    walkDirectories(join(packageDir, folder)).flatMap((dir) =>
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && [".ts", ".mjs"].includes(extname(entry.name)))
        .map((entry) => join(dir, entry.name)),
    ),
  );

export const lintDirectories = (packageDir: string): string[] => ["src", "tests"].flatMap((folder) => walkDirectories(join(packageDir, folder)));

export const displayPath = (root: string, path: string): string => relative(root, path) || ".";
