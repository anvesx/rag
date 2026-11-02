import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = new URL("../..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "change-cursor-race-"));
const build = join(root, "node_modules/.cache/change-cursor-js"); // must sit under the package to resolve deps
const storeJs = pathToFileURL(join(build, "store.js")).href;
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(build, { recursive: true, force: true });
});

// Workers are plain Node, so compile src to JS first.
beforeAll(() => {
  const tsc = join(root, "../../node_modules/typescript/bin/tsc");
  execFileSync("node", [tsc, "-p", join(root, "tsconfig.build.json"), "--outDir", build, "--declaration", "false"], { cwd: root });
}, 120_000);

/** Starts `workers` threads on one file, releases them together, and returns what each saw as new. */
const contend = async (dbPath: string, tenants: string[], count: number): Promise<number[][]> => {
  const gate = new SharedArrayBuffer(8);
  const flags = new Int32Array(gate);
  const runs = tenants.map(
    (tenantId) =>
      new Promise<number[]>((resolve, reject) => {
        const w = new Worker(new URL("./worker.mjs", import.meta.url), { workerData: { storeJs, dbPath, tenantId, count, gate } });
        w.once("message", resolve);
        w.once("error", reject);
      }),
  );
  while (Atomics.load(flags, 0) < tenants.length) await new Promise((r) => setTimeout(r, 5));
  Atomics.store(flags, 1, 1);
  Atomics.notify(flags, 1);
  return Promise.all(runs);
};

describe("concurrent handles on one file race on seen", () => {
  it("lets exactly one of four workers see each id as new", async () => {
    const dbPath = join(dir, "race.db");
    const { createCursorStore } = await import(storeJs);
    createCursorStore(dbPath, () => 0); // create the schema before the race
    const count = 10_000;
    const results = await contend(dbPath, ["t", "t", "t", "t"], count);
    const all = results.flat().sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: count }, (_, i) => i)); // no id lost, none seen as new twice
  }, 120_000);

  it("keeps tenants apart under contention: each tenant sees every id as new once", async () => {
    const dbPath = join(dir, "tenants.db");
    const { createCursorStore } = await import(storeJs);
    createCursorStore(dbPath, () => 0);
    const results = await contend(dbPath, ["a", "b"], 500);
    for (const r of results) expect(r).toEqual(Array.from({ length: 500 }, (_, i) => i));
  }, 120_000);
});
