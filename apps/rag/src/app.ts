import { startMcpServer } from "@rag/mcp-service";
import { createGate } from "./ops/gate.js";
import { startHealth } from "./ops/health.js";
import { readiness } from "./ops/ready.js";
import { defaultLogger } from "./runtime/logger.js";
import { openStores } from "./runtime/stores.js";
import { bounded } from "./runtime/timeouts.js";
import type { RagApp, RagDeps } from "./types.js";
import { resolveDimension } from "./wire/dimension.js";
import { createPipeline } from "./wire/pipeline.js";

const DEFAULT_DRAIN_MS = 10_000;

/** Composes ingestion, governed search, the MCP server and health. Every external call has a timeout; close drains, then closes every database. */
export async function createRagApp(given: RagDeps): Promise<RagApp> {
  const deps: RagDeps = { ...given, ...bounded(given, given.timeouts) };
  const dimension = await resolveDimension(deps);
  const logger = deps.logger ?? defaultLogger;
  const stores = openStores(deps, dimension);
  const gate = createGate();
  let server: Awaited<ReturnType<typeof startMcpServer>> | undefined;
  let health: Awaited<ReturnType<typeof startHealth>> | undefined;
  try {
    const pipeline = createPipeline(deps, stores, logger);
    const search: RagApp["search"] = (input) => gate.run(() => pipeline.search(input));
    server = await startMcpServer({
      transport: deps.transport,
      port: deps.port,
      host: deps.host,
      allowedHosts: deps.allowedHosts,
      allowedOrigins: deps.allowedOrigins,
      stdin: deps.stdin,
      stdout: deps.stdout,
      principalFor: deps.principalFor,
      // Cause name and message only: never the query, the principal or the token.
      logger: (cause) => logger.error("search failed", { cause: cause instanceof Error ? `${cause.name}: ${cause.message}` : "non-error thrown" }),
      search: ({ query, limit, principal }) => search({ query, limit, principal }),
    });
    if (deps.healthPort !== undefined) {
      health = await startHealth({
        port: deps.healthPort,
        host: deps.host ?? "127.0.0.1",
        draining: gate.draining,
        probe: readiness(stores.probe, deps.ready, deps.timeouts?.embedQueryMs ?? 5_000),
      });
    }
    let closing: Promise<void> | undefined;
    const running = server;
    return {
      ingest: (tenantId) => gate.run(() => pipeline.ingest(tenantId)),
      search,
      verify: pipeline.verify,
      checkpoint: pipeline.checkpoint,
      close: () =>
        (closing ??= (async () => {
          gate.begin();
          await gate.idle(deps.drainMs ?? DEFAULT_DRAIN_MS);
          try {
            await running.close();
          } finally {
            try {
              await health?.close();
            } finally {
              stores.close();
            }
          }
        })()),
      port: server.port,
      healthPort: health?.port,
    };
  } catch (error) {
    await health?.close();
    await server?.close();
    stores.close();
    throw error;
  }
}
