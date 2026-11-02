import { defineConfig } from "vitest/config";

// Mutation runs skip the 5 MB timing test: Stryker's per-test instrumentation makes its 3 s
// budget meaningless. The other scale tests assert behaviour and stay in, they kill mutants.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/scale/five-mb.test.ts"] },
});
