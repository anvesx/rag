import { afterEach, describe, expect, it } from "vitest";
import { as, closeAll, raw, up } from "./kit.js";

afterEach(closeAll);
const err = (message: string) => ({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });

describe("error replies are generic JSON-RPC bodies", () => {
  it.each([
    ["unauthenticated", {}, undefined, 401, "Unauthenticated"],
    ["missing session id", as("a"), JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }), 400, "Missing session id"],
    ["unknown session", { ...as("a"), "mcp-session-id": "nope" }, undefined, 404, "Unknown session"],
    ["foreign host", { ...as("a"), host: "evil.example" }, undefined, 403, "Forbidden host"],
  ])("%s", async (_name, headers, body, status, message) => {
    const { port } = await up();
    const res = await raw(port, headers, body);
    expect(res.status).toBe(status);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual(err(message));
    expect(res.headers.connection).toBe("keep-alive");
  });

  it("closes the connection after a 413 and reports other paths as 404 Not found", async () => {
    const { port } = await up();
    const big = await raw(port, as("a"), JSON.stringify({ pad: "x".repeat(1_100_000) }));
    expect(big.status).toBe(413);
    expect(big.headers.connection).toBe("close");
    const other = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      import("node:http").then(({ request }) =>
        request({ host: "127.0.0.1", port, path: "/other", headers: as("a") }, (res) => {
          let text = "";
          res.on("data", (d) => (text += d));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text }));
        })
          .on("error", reject)
          .end(),
      );
    });
    expect(other.status).toBe(404);
    expect(JSON.parse(other.body)).toEqual(err("Not found"));
  });

  it("a session owned by another principal is 403 with the generic message", async () => {
    const { port } = await up();
    const first = await raw(port, as("alice"));
    const stolen = await raw(port, { ...as("mallory"), "mcp-session-id": first.sid as string });
    expect(stolen.status).toBe(403);
    expect(JSON.parse(stolen.body)).toEqual(err("Session belongs to another principal"));
  });
});
