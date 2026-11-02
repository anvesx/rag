import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = new URL("../..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "audit-conc-")); // databases
const build = join(root, "node_modules/.cache/audit-chain-js"); // compiled JS; must sit under the package to resolve deps
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(build, { recursive: true, force: true });
});

// Workers are plain Node, so compile src to JS in the temp dir first.
beforeAll(() => {
  execFileSync(
    "node",
    [join(root, "../../node_modules/typescript/bin/tsc"), "-p", join(root, "tsconfig.build.json"), "--outDir", build, "--declaration", "false"],
    { cwd: root },
  );
}, 120_000);

const run = (dbPath: string, tenantId: string, count: number) =>
  new Promise<number[]>((resolve, reject) => {
    const w = new Worker(new URL("./worker.mjs", import.meta.url), {
      workerData: { chainJs: pathToFileURL(join(build, "chain.js")).href, dbPath, tenantId, count },
    });
    w.once("message", resolve);
    w.once("error", reject);
  });

describe("concurrent handles on one file", () => {
  it("never fork the chain: seq unique and gapless, verify ok", async () => {
    const dbPath = join(dir, "c.db");
    const { createAuditChain } = await import(pathToFileURL(join(build, "chain.js")).href);
    createAuditChain(dbPath); // create schema before the race
    const [a, b] = await Promise.all([run(dbPath, "t", 150), run(dbPath, "t", 150)]);
    const all = [...a, ...b].sort((x, y) => x - y);
    expect(all).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
    expect(createAuditChain(dbPath).verify("t")).toEqual({ ok: true });
    expect(createAuditChain(dbPath).list("t", 0, 1000)).toHaveLength(300);
  }, 120_000);
});
