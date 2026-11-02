import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], globalSetup: ["tests/integration/global-setup.ts"], coverage: { thresholds: { lines: 90 } } },
});
