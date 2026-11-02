import { defineConfig } from "vitest/config";
// Mutation runs skip scale (minutes) and concurrency (tests compiled JS, not instrumented src).
export default defineConfig({ test: { include: ["tests/{unit,property,integration}/**/*.test.ts"], exclude: ["tests/integration/concurrency.test.ts"] } });
