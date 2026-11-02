import type { APIRequestContext } from "@playwright/test";

const headers = (token: string, session?: string) => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: `Bearer ${token}`,
  ...(session ? { "mcp-session-id": session } : {}),
});

const data = (body: string) =>
  JSON.parse(
    body
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6) ?? "{}",
  );

export const search = async (api: APIRequestContext, url: string, token: string, query: string): Promise<string> => {
  const init = await api.post(url, {
    headers: headers(token),
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "e2e", version: "1" } },
    },
  });
  const session = init.headers()["mcp-session-id"];
  await api.post(url, { headers: headers(token, session), data: { jsonrpc: "2.0", method: "notifications/initialized" } });
  const call = await api.post(url, {
    headers: headers(token, session),
    data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query } } },
  });
  return JSON.stringify(data(await call.text()));
};
