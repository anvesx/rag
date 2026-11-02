import { afterEach, describe, expect, it } from "vitest";
import { connect, rig, type ToolResult, urlOf } from "../harness.js";

const open: Array<{ close(): Promise<unknown> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close().catch(() => undefined)));
});
const search = async (r: ReturnType<typeof rig>, extra = {}) => {
  const h = await r.start(extra);
  open.push(h);
  const c = await connect(h.port, "alice");
  open.push(c);
  return { h, res: (await c.callTool({ name: "search", arguments: { query: "needle" } })) as ToolResult };
};

describe("retrieval failures and transport", () => {
  it("turns an embedQuery failure into a safe MCP error", async () => {
    const r = rig();
    r.seed("doc", ["alice"]);
    const logged: unknown[] = [];
    const embedQuery = async () => {
      throw new Error("secret-key-leak");
    };
    const { res } = await search(r, { embedQuery, logger: (e: unknown) => logged.push(e) });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toBe("Search failed");
    expect(JSON.stringify(res)).not.toContain("secret-key-leak");
    expect(logged).toHaveLength(1);
  });

  it("turns a wrong-dimension embedding into a safe MCP error", async () => {
    const r = rig();
    r.seed("doc", ["alice"]);
    const { res } = await search(r, { embedQuery: async () => [1, 0, 0] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toBe("Search failed");
  });

  it("rejects unauthenticated HTTP with 401", async () => {
    const h = await rig().start();
    open.push(h);
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const res = await fetch(urlOf(h.port), { method: "POST", body: "{}", headers });
    expect(res.status).toBe(401);
    await expect(connect(h.port)).rejects.toThrow();
  });

  it("close is idempotent and frees the port", async () => {
    const h = await rig().start();
    await h.close();
    await h.close();
    await expect(connect(h.port, "alice")).rejects.toThrow();
  });
});
