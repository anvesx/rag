// Open-loop latency bench. Usage: node scripts/bench/run.mjs [--sizes 1000,10000] [--rate 20] [--samples 1500]
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import * as hdr from "hdr-histogram-js";
import { RankIndex } from "../../dist/index.js";
import { makeDocs, makeQueries } from "./corpus.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};
const sizes = String(arg("sizes", "1000,10000")).split(",").map(Number);
const rate = Number(arg("rate", 20));
const samples = Number(arg("samples", 1500));
const NOW = Date.UTC(2026, 10, 2);
const KEY = "rank-bench-key-0123456789abcdef";
const mkHist = () => hdr.build({ lowestDiscernibleValue: 1, highestTrackableValue: 3_600_000_000, numberOfSignificantValueDigits: 3 });
const us = (ms) => Math.max(1, Math.round(ms * 1000));
const fmt = (h) => [50, 95, 99].map((p) => `p${p} ${(h.getValueAtPercentile(p) / 1000).toFixed(2)}ms`).join("  ");

const run = async (size) => {
  const dir = mkdtempSync(join(tmpdir(), "rank-bench-"));
  const file = join(dir, "rank.sqlite");
  const ix = RankIndex.open(file, { key: KEY, now: () => NOW });
  const docs = makeDocs(size, NOW);
  const t0 = performance.now();
  for (let i = 0; i < docs.length; i += 500) ix.index(docs.slice(i, i + 500));
  const indexMs = performance.now() - t0;
  ix.close();
  const bytes = statSync(file).size;
  const db = RankIndex.open(file, { key: KEY, now: () => NOW });
  const queries = makeQueries(samples + 200);
  for (const q of queries.slice(0, 200)) db.search({ query: q.query, asker: { principals: q.principals }, k: 10 });
  const total = mkHist();
  const stages = new Map();
  const probe = (stage, ms) => {
    if (!stages.has(stage)) stages.set(stage, mkHist());
    stages.get(stage).recordValue(us(ms));
  };
  const cpu0 = process.cpuUsage();
  const start = performance.now();
  const interval = 1000 / rate;
  for (let i = 0; i < samples; i++) {
    const scheduled = start + i * interval;
    const wait = scheduled - performance.now();
    if (wait > 1) await sleep(wait - 1);
    while (performance.now() < scheduled) {} // spin the last millisecond for an accurate arrival time
    const q = queries[200 + i];
    db.search({ query: q.query, asker: { principals: q.principals }, k: 10 }, probe);
    total.recordValue(us(performance.now() - scheduled)); // measured from the scheduled arrival, so a backlog is counted
  }
  const cpu = process.cpuUsage(cpu0);
  db.close();
  rmSync(dir, { recursive: true, force: true });
  console.log(`\ncorpus ${size} docs, ${samples} samples at ${rate}/s open loop`);
  console.log(`  latency   ${fmt(total)}  max ${(total.maxValue / 1000).toFixed(2)}ms`);
  for (const [name, h] of stages) console.log(`  stage ${name.padEnd(8)} ${fmt(h)}`);
  console.log(`  index     ${(bytes / size).toFixed(0)} bytes/doc (${(bytes / 1e6).toFixed(2)} MB file), built in ${indexMs.toFixed(0)}ms`);
  console.log(`  cpu       ${((cpu.user + cpu.system) / 1000 / samples).toFixed(3)} ms/query (user+system)`);
};

for (const size of sizes) await run(size);
