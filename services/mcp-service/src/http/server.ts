import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { type Principal, PrincipalSchema } from "@brain/core-types";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerDeps } from "../build.js";
import { McpServiceError } from "../errors.js";
import { readJson } from "./body.js";
import { type HostOptions, hostAllowed, resolvePolicy } from "./guard.js";
import { type LimitOptions, realTimers, resolveLimits, type Timers } from "./limits.js";
import { Sessions } from "./sessions.js";

export type HttpOptions = HostOptions & LimitOptions & { port: number; host?: string; path?: string; timers?: Timers | undefined };
export type HttpHandle = { port: number; close(): Promise<void> };
const STATUS = { UNAUTHENTICATED: 401, FORBIDDEN: 403, BAD_JSON: 400, BODY_TOO_LARGE: 413, INVALID_CONFIG: 500, TOO_MANY_SESSIONS: 429 };

function reply(res: ServerResponse, status: number, message: string): void {
  if (res.headersSent) return void res.end();
  res.writeHead(status, { "content-type": "application/json", connection: status === 413 ? "close" : "keep-alive" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

export async function startHttp(deps: McpServerDeps, opts: HttpOptions): Promise<HttpHandle> {
  const limits = resolveLimits(opts);
  let sessions: Sessions; // built after listen(): default host lists need the bound port
  let policy = resolvePolicy(opts.port, opts);

  /** Authenticate with the same resolver the tool uses, so a request that cannot resolve never reaches the SDK. */
  const authenticate = (req: IncomingMessage): Principal => {
    try {
      return PrincipalSchema.parse(deps.principalFor({ requestInfo: { headers: req.headers } }));
    } catch {
      throw new McpServiceError("UNAUTHENTICATED", "Unauthenticated");
    }
  };

  async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!hostAllowed(policy, req.headers)) throw new McpServiceError("FORBIDDEN", "Forbidden host");
    if (new URL(req.url ?? "/", "http://localhost").pathname !== (opts.path ?? "/mcp")) return reply(res, 404, "Not found");
    const caller = authenticate(req);
    const body = req.method === "POST" ? await readJson(req) : undefined;
    const sid = req.headers["mcp-session-id"];
    if (typeof sid === "string") {
      const found = sessions.get(sid);
      if (!found) return reply(res, 404, "Unknown session");
      if (found.owner.id !== caller.id || found.owner.tenantId !== caller.tenantId) {
        throw new McpServiceError("FORBIDDEN", "Session belongs to another principal");
      }
      return found.transport.handleRequest(req, res, body);
    }
    if (req.method !== "POST" || !isInitializeRequest(body)) return reply(res, 400, "Missing session id");
    const session = sessions.open(deps, caller);
    await session.server.connect(session.transport);
    return session.transport.handleRequest(req, res, body);
  }

  const http = createServer((req, res) => {
    dispatch(req, res).catch((error: unknown) => {
      if (error instanceof McpServiceError) return reply(res, STATUS[error.code], error.message);
      deps.logger?.(error);
      reply(res, 500, "Internal error");
    });
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(opts.port, opts.host ?? "127.0.0.1", resolve);
  });
  const port = (http.address() as AddressInfo).port;
  policy = resolvePolicy(port, opts);
  sessions = new Sessions({ limits, timers: opts.timers ?? realTimers, policy });

  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const stopped = new Promise<void>((resolve) => http.close(() => resolve()));
      await sessions.closeAll();
      http.closeAllConnections();
      await stopped;
    })());
  return { port, close };
}
