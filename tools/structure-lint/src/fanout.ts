import { readdirSync } from "node:fs";
import { displayPath, lintDirectories, type Violation } from "./fs/walk.ts";

export const checkFanout = (root: string, packages: readonly string[]): Violation[] =>
  packages.flatMap((packageDir) =>
    lintDirectories(packageDir).flatMap((dir) => {
      const count = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name !== "README.md").length;
      return count > 5
        ? [
            {
              file: displayPath(root, dir),
              rule: "fanout",
              message: `${count} files exceeds 5`,
            },
          ]
        : [];
    }),
  );
