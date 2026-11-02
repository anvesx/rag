import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { createRegistry } from "../../src/index.js";

const here = (f: string): string => fileURLToPath(new URL(f, import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const run = (file: string, k: number, startAt: number, rounds: number) =>
  new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
    const c = spawn(process.execPath, ["--import", here("loader.mjs"), here("worker.ts"), file, String(k), String(startAt), String(rounds)]);
    const out: string[] = [];
    const err: string[] = [];
    c.stdout.on("data", (d) => out.push(String(d)));
    c.stderr.on("data", (d) => err.push(String(d)));
    c.on("close", (code) => resolve({ code, out: out.join(""), err: err.join("") }));
  });

it("6 OS processes upserting one key at once: no error, exactly one created, one row, no lost call", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-"));
  dirs.push(dir);
  const file = join(dir, "r.db");
  createRegistry(file).close();
  const [procs, rounds] = [6, 150];
  const startAt = Date.now() + 1500;
  const res = await Promise.all(Array.from({ length: procs }, (_, k) => run(file, k, startAt, rounds)));
  for (const r of res) expect({ code: r.code, err: r.err }).toEqual({ code: 0, err: "" });
  const sum = { created: 0, updated: 0, unchanged: 0 };
  for (const r of res) for (const [key, n] of Object.entries(JSON.parse(r.out) as typeof sum)) sum[key as keyof typeof sum] += n;
  expect(sum.created).toBe(1);
  expect(sum.created + sum.updated + sum.unchanged).toBe(procs * rounds);
  expect(sum.updated).toBeGreaterThan(0);
  const reg = createRegistry(file);
  const all = reg.list({ tenantId: "t1", limit: 1000 });
  expect(all.filter((p) => p.id === "doc-1")).toHaveLength(1);
  expect(all).toHaveLength(1 + procs * rounds);
  reg.close();
}, 60_000);
