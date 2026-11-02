import type { Readable, Writable } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, type McpServerDeps } from "./build.js";

export type StdioIo = { stdin?: Readable; stdout?: Writable };
export type Closer = { close(): Promise<void> };

export async function startStdio(deps: McpServerDeps, io: StdioIo = {}): Promise<Closer> {
  const server = buildServer(deps);
  await server.connect(new StdioServerTransport(io.stdin, io.stdout));
  let closing: Promise<void> | undefined;
  return { close: () => (closing ??= server.close()) };
}
