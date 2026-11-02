import { describe, expect, it } from "vitest";
import type { McpServiceError } from "../../src/errors.js";
import { resolveLimits, type SessionLimits } from "../../src/http/limits.js";
import { Sessions } from "../../src/http/sessions.js";
import { fakeTimers } from "../security/fake-timers.js";

const deps = { search: async () => [], principalFor: () => ({ id: "u", tenantId: "t", groups: [] }) };
const who = (id: string, tenantId = "t") => ({ id, tenantId, groups: [] });
const policy = { allowedHosts: ["localhost:1"], allowedOrigins: [] };

function make(limits: Partial<SessionLimits>) {
  const timers = fakeTimers();
  return { timers, sessions: new Sessions({ limits: resolveLimits(limits), timers, policy }) };
}
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as McpServiceError).code;
  }
};

describe("session limits", () => {
  it("rejects opens beyond maxSessions with TOO_MANY_SESSIONS", () => {
    const { sessions } = make({ maxSessions: 2 });
    sessions.open(deps, who("a"));
    sessions.open(deps, who("b"));
    expect(codeOf(() => sessions.open(deps, who("c")))).toBe("TOO_MANY_SESSIONS");
  });

  it("rejects opens beyond maxSessionsPerPrincipal but admits others, scoped by tenant", () => {
    const { sessions } = make({ maxSessionsPerPrincipal: 1 });
    sessions.open(deps, who("a"));
    expect(codeOf(() => sessions.open(deps, who("a")))).toBe("TOO_MANY_SESSIONS");
    expect(codeOf(() => sessions.open(deps, who("b")))).toBeUndefined();
    expect(codeOf(() => sessions.open(deps, who("a", "other")))).toBeUndefined();
  });

  it("closes an idle session at idleTimeoutMs and frees its slot and timer", async () => {
    const { sessions, timers } = make({ maxSessions: 1, idleTimeoutMs: 1000 });
    const s = sessions.open(deps, who("a"));
    let closed = 0;
    s.transport.onclose = () => closed++;
    timers.advance(999);
    expect(sessions.size()).toBe(1);
    timers.advance(1);
    await new Promise((r) => setImmediate(r));
    expect(sessions.size()).toBe(0);
    expect(timers.pending()).toBe(0);
    expect(closed).toBeGreaterThan(0);
    expect(codeOf(() => sessions.open(deps, who("b")))).toBeUndefined();
  });

  it("restarts the idle clock when a session is looked up by id", () => {
    const { sessions, timers } = make({ idleTimeoutMs: 1000 });
    const s = sessions.open(deps, who("a"));
    sessions.register("sid-1", s);
    timers.advance(900);
    expect(sessions.get("sid-1")).toBe(s);
    timers.advance(900);
    expect(sessions.size()).toBe(1);
    timers.advance(100);
    expect(sessions.size()).toBe(0);
    expect(sessions.get("sid-1")).toBeUndefined();
  });

  it("closeAll empties the registry and cancels timers", async () => {
    const { sessions, timers } = make({});
    sessions.open(deps, who("a"));
    await sessions.closeAll();
    expect(sessions.size()).toBe(0);
    expect(timers.pending()).toBe(0);
  });
});
