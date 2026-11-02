export const TOKEN = "alice:acme";

export const baseHeaders = (session?: string): Record<string, string> => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: `Bearer ${TOKEN}`,
  ...(session ? { "mcp-session-id": session } : {}),
});

export const searchBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: { name: "search", arguments: { query: "welcome", limit: 5 } },
});

/** MCP streamable HTTP handshake: initialize, then notifications/initialized. Returns the session id. */
export async function initSession(url: string): Promise<string> {
  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "scale", version: "1" } },
  };
  const res = await fetch(url, { method: "POST", headers: baseHeaders(), body: JSON.stringify(init) });
  const session = res.headers.get("mcp-session-id");
  if (!res.ok || !session) throw new Error(`initialize failed: ${res.status}`);
  await res.text();
  const note = { jsonrpc: "2.0", method: "notifications/initialized" };
  await fetch(url, { method: "POST", headers: baseHeaders(session), body: JSON.stringify(note) });
  return session;
}
