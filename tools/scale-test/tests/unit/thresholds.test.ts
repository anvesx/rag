import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../src/search.js", import.meta.url), "utf8");

describe("k6 search scenario", () => {
  it("keeps the failure-rate and latency thresholds", () => {
    expect(script).toContain('http_req_failed: ["rate<0.01"]');
    expect(script).toContain('http_req_duration: ["p(95)<500"]');
  });
  it("calls the search tool with a bearer token", () => {
    expect(script).toContain('name: "search"');
    expect(script).toContain("authorization");
  });
});
