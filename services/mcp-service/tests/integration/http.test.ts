import { afterEach, describe, expect, it } from "vitest";
import { createHttpKit, httpClient, titleOf } from "./harness.js";

const { up, connect, post, teardown } = createHttpKit();
afterEach(teardown);

describe("streamable HTTP transport on an ephemeral port", () => {
  it("binds a real ephemeral port and serves search for the header principal", async () => {
    const s = await up();
    expect(s.port).toBeGreaterThan(0);
    const c = await connect(s, "alice");
    expect((await c.listTools()).tools.map((t) => t.name)).toEqual(["search"]);
    expect(titleOf(await c.callTool({ name: "search", arguments: { query: "q" } }))).toBe("alice:q");
  });

  it("rejects unauthenticated requests with 401 and no session", async () => {
    const s = await up();
    const res = await post(s, {});
    expect(res.status).toBe(401);
    expect(res.headers.get("mcp-session-id")).toBeNull();
    await expect(httpClient(s.url)).rejects.toThrow();
  });

  it("serves many concurrent clients without crossing principals", async () => {
    const s = await up();
    const ids = Array.from({ length: 8 }, (_, i) => `user-${i}`);
    const cs = await Promise.all(ids.map((id) => connect(s, id)));
    const out = await Promise.all(cs.map((c, i) => c.callTool({ name: "search", arguments: { query: String(i) } })));
    expect(out.map(titleOf)).toEqual(ids.map((id, i) => `${id}:${i}`));
  });

  it("refuses a session id presented by a different principal", async () => {
    const s = await up();
    const first = await post(s, { authorization: "Bearer alice" });
    const sid = first.headers.get("mcp-session-id") as string;
    expect(sid).toBeTruthy();
    const stolen = await post(s, { authorization: "Bearer mallory", "mcp-session-id": sid });
    expect(stolen.status).toBe(403);
  });

  it("closes gracefully with live sessions, is idempotent, and frees the port", async () => {
    const s = await up();
    await connect(s, "alice");
    await s.close();
    await s.close();
    await expect(post(s, { authorization: "Bearer alice" })).rejects.toThrow();
  });
});
