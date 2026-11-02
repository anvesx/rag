import { defineConfig } from "vitest/config";

// Mutation runs use unit and integration tests only. The scale tests time the code,
// and Stryker's per-test instrumentation makes those timings meaningless.
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"] },
});
