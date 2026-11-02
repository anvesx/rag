import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The stdio child imports the built package, so build it once before any test runs. */
export default function setup(): void {
  const cwd = fileURLToPath(new URL("../..", import.meta.url));
  execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], { cwd, stdio: "inherit" });
}
