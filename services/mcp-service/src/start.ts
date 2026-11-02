import type { Readable, Writable } from "node:stream";
import type { McpServerDeps } from "./build.js";
import { McpServiceError } from "./errors.js";
import { type HttpOptions, startHttp } from "./http/server.js";
import { startStdio } from "./stdio.js";

export type McpServiceOptions = McpServerDeps & {
  transport: "stdio" | "http";
  /** HTTP only. 0 (the default) asks the OS for an ephemeral port. */
  port?: number | undefined;
  host?: string | undefined;
  /** stdio only; default to process.stdin / process.stdout. */
  stdin?: Readable | undefined;
  stdout?: Writable | undefined;
} & Omit<HttpOptions, "port" | "host" | "path">; // HTTP-only tuning: session limits, allowed hosts/origins, timers

export type RunningMcpServer = { close(): Promise<void>; port: number | undefined };

export async function startMcpServer(opts: McpServiceOptions): Promise<RunningMcpServer> {
  const { transport, port, host, stdin, stdout, search, principalFor, logger, ...tuning } = opts;
  const deps = { search, principalFor, logger };
  if (transport === "stdio") {
    if (port !== undefined) throw new McpServiceError("INVALID_CONFIG", "port is only valid for the http transport");
    const running = await startStdio(deps, { ...(stdin && { stdin }), ...(stdout && { stdout }) });
    return { close: running.close, port: undefined };
  }
  if (transport !== "http") throw new McpServiceError("INVALID_CONFIG", `unknown transport: ${String(transport)}`);
  if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port <= 65535)) {
    throw new McpServiceError("INVALID_CONFIG", `invalid port: ${port}`);
  }
  return startHttp(deps, { ...tuning, port: port ?? 0, ...(host && { host }) });
}
