import { check } from "k6";
import http from "k6/http";

const base = __ENV.RAG_URL || "http://127.0.0.1:3000/mcp";
const token = __ENV.RAG_TOKEN || "alice:acme";
const headers = (session) => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: `Bearer ${token}`,
  ...(session ? { "mcp-session-id": session } : {}),
});

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: __ENV.K6_RAMP || "30s", target: 50 },
        { duration: __ENV.K6_HOLD || "1m", target: 50 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] },
};

const body = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query: "welcome", limit: 5 } } });

/** MCP streamable HTTP handshake once, shared by every VU. */
export function setup() {
  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "k6", version: "1" } },
  };
  const res = http.post(base, JSON.stringify(init), { headers: headers() });
  const session = res.headers["Mcp-Session-Id"];
  if (res.status !== 200 || !session) throw new Error(`initialize failed: ${res.status}`);
  http.post(base, JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), { headers: headers(session) });
  return { session };
}

export default function (data) {
  const res = http.post(base, body, { headers: headers(data.session) });
  check(res, { "status 200": (r) => r.status === 200 });
}
