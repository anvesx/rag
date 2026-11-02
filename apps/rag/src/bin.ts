#!/usr/bin/env node
import { mintTokenCli } from "./cli/mint-token.js";
import { startFromEnv } from "./cli/serve.js";
import { installShutdown } from "./ops/shutdown.js";

const fail = (error: unknown): never => {
  console.error(`rag: ${error instanceof Error ? error.message : String(error)}`);
  return process.exit(1);
};

if (process.argv[2] === "mint-token") {
  try {
    console.log(mintTokenCli(process.argv.slice(3), process.env));
    process.exit(0);
  } catch (error) {
    fail(error);
  }
}

try {
  const { app, forceExitMs, host } = await startFromEnv(process.env, { log: console.log, error: console.error });
  console.log(`rag listening on http://${host}:${app.port}/mcp`);
  if (app.healthPort !== undefined) console.log(`rag health on http://${host}:${app.healthPort}`);
  installShutdown({ close: app.close, forceExitMs });
} catch (error) {
  fail(error);
}
