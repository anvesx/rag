import { describe, expect, it } from "vitest";
import { resolveLimits } from "../../src/http/limits.js";
import { McpServiceError, startMcpServer } from "../../src/index.js";

const base = { search: async () => [], principalFor: () => ({ id: "u", tenantId: "t", groups: [] }) };

describe("startMcpServer configuration", () => {
  it.each([
    ["unknown transport", { transport: "ws" }],
    ["negative port", { transport: "http", port: -1 }],
    ["fractional port", { transport: "http", port: 1.5 }],
    ["port above 65535", { transport: "http", port: 70000 }],
    ["port with stdio", { transport: "stdio", port: 80 }],
  ])("rejects %s with INVALID_CONFIG", async (_name, extra) => {
    const err = await startMcpServer({ ...base, ...extra } as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(McpServiceError);
    expect((err as McpServiceError).code).toBe("INVALID_CONFIG");
  });
});

describe("resolveLimits", () => {
  it("fills documented defaults", () => {
    expect(resolveLimits()).toEqual({ maxSessions: 1000, maxSessionsPerPrincipal: 20, idleTimeoutMs: 1_800_000 });
  });
  it.each([{ maxSessions: 0 }, { maxSessions: 1.5 }, { maxSessionsPerPrincipal: -1 }, { idleTimeoutMs: 0 }, { idleTimeoutMs: Number.NaN }])(
    "rejects %j",
    (bad) => {
      expect(() => resolveLimits(bad)).toThrow(McpServiceError);
    },
  );
});
