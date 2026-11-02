// Starts the rank server, runs the k6 script against it, stops the server.
// Usage: node bin/run.mjs [--docs 10000]
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeQueries } from "../../../features/rank/scripts/bench/corpus.mjs";
import { describeHost } from "../src/env.mjs";
import { ports, rankServer, waitFor } from "../src/servers.mjs";
import { exitCode, reportPath } from "./outcome.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : dflt);
const docs = Number(arg("docs", 10000));
const dir = mkdtempSync(join(tmpdir(), "scale-k6-"));
const queries = join(dir, "queries.json");
writeFileSync(queries, JSON.stringify(makeQueries(500)));
mkdirSync(dirname(reportPath("rank")), { recursive: true });

const k6 = (script, env) => {
  const args = ["run", "--quiet", "--summary-export", reportPath(script), ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`])];
  return exitCode(spawnSync("k6", [...args, join(root, "scripts", `${script}.js`)], { stdio: "inherit" }));
};

console.log(describeHost());
const server = rankServer(docs);
let code = 1;
try {
  await waitFor(`http://127.0.0.1:${ports.rank}/healthz`);
  code = k6("rank", { BASE: `http://127.0.0.1:${ports.rank}`, QUERIES: queries, DOCS: docs });
} finally {
  server.kill("SIGTERM");
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
