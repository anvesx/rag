import { afterEach, describe, expect, it } from "vitest";
import { createHttpKit } from "./harness.js";

const { up, post, teardown } = createHttpKit();
afterEach(teardown);
const auth = { authorization: "Bearer a" };

describe("streamable HTTP protocol edges", () => {
  it("maps protocol misuse to 400/404/413 and unknown paths to 404", async () => {
    const s = await up();
    const listBody = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect((await post(s, auth, "{nope")).status).toBe(400);
    expect((await post(s, auth, listBody)).status).toBe(400);
    expect((await post(s, { ...auth, "mcp-session-id": "missing" })).status).toBe(404);
    expect((await post(s, auth, JSON.stringify({ pad: "x".repeat(1_100_000) }))).status).toBe(413);
    expect((await fetch(new URL("/other", s.url), { headers: auth })).status).toBe(404);
  });

  it("ends a session on DELETE", async () => {
    const s = await up();
    const sid = (await post(s, auth)).headers.get("mcp-session-id") as string;
    const del = await fetch(s.url, { method: "DELETE", headers: { ...auth, "mcp-session-id": sid } });
    expect(del.status).toBe(200);
    expect((await post(s, { ...auth, "mcp-session-id": sid })).status).toBe(404);
  });

  it("rejects GET without a session as 400", async () => {
    const s = await up();
    expect((await fetch(s.url, { headers: { ...auth, accept: "text/event-stream" } })).status).toBe(400);
  });
});
