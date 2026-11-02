import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import autocannon from "autocannon";
import { baseHeaders, initSession, searchBody } from "./mcp.ts";
import { startServer } from "./server.ts";
import { evaluate, type Stats } from "./thresholds.ts";

const seconds = Number(process.env.SCALE_STAGE_SECONDS ?? 10);
const stages = (process.env.SCALE_CONNECTIONS ?? "5,25,50").split(",").map(Number);

/** autocannon has no p95; p97.5 is the next percentile up, so passing it implies p95 passes. */
const toStats = (r: autocannon.Result): Stats => ({ requests: r.requests.total, errors: r.errors + r.timeouts + r.non2xx, p95Ms: r.latency.p97_5 });

const server = await startServer();
let failed = false;
try {
  if (process.env.SCALE_ENGINE === "k6") {
    const k6 = spawnSync("k6", ["run", resolve(import.meta.dirname, "search.js")], { stdio: "inherit", env: { ...process.env, RAG_URL: server.url } });
    failed = k6.status !== 0;
  } else {
    const session = await initSession(server.url);
    console.log(`server ${server.url} session ${session.slice(0, 8)}... stages ${stages.join("/")} connections x ${seconds}s`);
    for (const connections of stages) {
      const r = await autocannon({ url: server.url, method: "POST", headers: baseHeaders(session), body: searchBody, connections, duration: seconds });
      const verdict = evaluate(toStats(r));
      failed ||= !verdict.ok;
      const { p50, p97_5, p99 } = r.latency;
      console.log(
        `conn=${connections} requests=${r.requests.total} p50=${p50}ms p95<=${p97_5}ms(p97.5) p99=${p99}ms errors=${r.errors} timeouts=${r.timeouts} non2xx=${r.non2xx} rps=${r.requests.average} ${verdict.ok ? "PASS" : `FAIL ${verdict.violations.join("; ")}`}`,
      );
    }
  }
} finally {
  console.log(`server exit code ${await server.stop()}`);
}
process.exit(failed ? 1 : 0);
