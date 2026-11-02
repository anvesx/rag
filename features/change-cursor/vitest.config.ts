import { defineConfig } from "vitest/config";
export default defineConfig({ test: { testTimeout: 30_000, include: ["tests/**/*.test.ts"], coverage: { thresholds: { lines: 90 } } } });
