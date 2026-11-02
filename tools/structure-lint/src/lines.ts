import { readFileSync } from "node:fs";
import { codeFiles, displayPath, type Violation } from "./fs/walk.ts";

const countLines = (content: string): number => {
  if (content.length === 0) return 0;
  const parts = content.split(/\r?\n/);
  return parts.at(-1) === "" ? parts.length - 1 : parts.length;
};

export const checkLines = (root: string, packages: readonly string[]): Violation[] =>
  packages.flatMap((packageDir) =>
    codeFiles(packageDir).flatMap((file) => {
      const lines = countLines(readFileSync(file, "utf8"));
      return lines > 80
        ? [
            {
              file: displayPath(root, file),
              rule: "lines",
              message: `${lines} lines exceeds 80`,
            },
          ]
        : [];
    }),
  );
