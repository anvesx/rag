import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const roots: string[] = [];

export const fixture = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "structure-lint-"));
  roots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

export const packageJson = (name: string, dependencies: Record<string, string> = {}): string => JSON.stringify({ name, dependencies });

export const cleanFixtures = (): void => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
};
