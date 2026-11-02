import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type Reply = { status: number; body: unknown };
export type Request = { url: URL; authorization: string | undefined };
export type Replay = { url: string; seen: Request[]; close: () => Promise<void> };

/**
 * A real local HTTP server standing in for api.github.com or the Drive API, so the vendor SDKs run their real request path
 * (same approach as services/connectors/tests/support). Each pathname maps to a reply that may depend on the caller's token.
 */
export async function startReplay(routes: Record<string, (req: Request) => Reply>): Promise<Replay> {
  const seen: Request[] = [];
  const server = createServer((req, res) => {
    const request = { url: new URL(req.url ?? "/", "http://127.0.0.1"), authorization: req.headers.authorization };
    seen.push(request);
    const route = routes[decodeURIComponent(request.url.pathname)];
    const reply = route ? route(request) : { status: 404, body: { message: "Not Found" } };
    res.writeHead(reply.status, { "content-type": typeof reply.body === "string" ? "text/plain" : "application/json" });
    res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return { url, seen, close };
}
