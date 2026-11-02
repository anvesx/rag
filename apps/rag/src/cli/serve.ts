import { createRagApp } from "../app.js";
import { resolveAuditKey } from "../auth/audit-key.js";
import { requireAuthMode } from "../auth/mode.js";
import { type Env, readEnv, readOps } from "../config/index.js";
import type { RagApp } from "../types.js";
import { sourceFor } from "./sources.js";

export type Io = { log: (line: string) => void; error: (line: string) => void };
export type Started = { app: RagApp; forceExitMs: number; host: string };

/**
 * Reads the environment, refuses an insecure combination, starts the app, then ingests each tenant once.
 * Throws a plain Error for any configuration problem, before any port is opened.
 */
export async function startFromEnv(env: Env, io: Io): Promise<Started> {
  const rag = readEnv(env);
  const ops = readOps(env, rag.port);
  if (!rag.demo && !rag.folderRoot && !rag.connector)
    throw new Error("no source configured. Set RAG_CONNECTOR=folder|github|drive and RAG_TENANT, or RAG_DEMO=1 for the demo connector");
  requireAuthMode(rag);
  const auditKey = resolveAuditKey(env, io.error);
  const source = sourceFor(rag, env);
  const { tenants, ...deps } = source;
  const app = await createRagApp({
    ...deps,
    cursors: rag.dataDir ? undefined : deps.cursors,
    dataDir: rag.dataDir,
    auditKey,
    auditDbPath: rag.auditDbPath,
    anchorPath: rag.anchorPath,
    transport: "http",
    port: rag.port,
    host: rag.host,
    allowedHosts: rag.allowedHosts,
    allowedOrigins: rag.allowedOrigins,
    timeouts: ops.timeouts,
    drainMs: ops.drainMs,
    healthPort: ops.healthPort,
  });
  try {
    // Load the model before the one-shot ingest so the first documents do not race the download; ingest still runs if it cannot load.
    await deps.ready?.().catch((error: unknown) => io.error(`rag: embedder not ready: ${error instanceof Error ? error.message : String(error)}`));
    for (const tenant of tenants) {
      const { indexed, failures, quarantined } = await app.ingest(tenant);
      io.log(`rag: ingested tenant ${tenant}: ${indexed} indexed, ${failures.length} failed, ${quarantined.length} quarantined`);
      for (const f of failures) io.error(`rag: ingest failed for ${tenant} ${f.address}: ${f.error}`);
      for (const f of quarantined) io.error(`rag: quarantined for ${tenant} ${f.address}: ${f.error}`);
    }
  } catch (error) {
    await app.close();
    throw error;
  }
  return { app, forceExitMs: ops.forceExitMs, host: rag.host ?? "127.0.0.1" };
}
