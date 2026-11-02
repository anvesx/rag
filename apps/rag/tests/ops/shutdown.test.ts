import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { installShutdown } from "../../src/ops/shutdown.js";
import { call, connect, idsOf, start } from "../harness.js";

const root = mkdtempSync(join(tmpdir(), "rag-shutdown-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const sidecars = (dir: string) => readdirSync(dir).filter((f) => /-(wal|shm)$/.test(f));

describe("graceful close", () => {
  it("closes every SQLite handle: no WAL or shm files are left behind", async () => {
    const dir = join(root, "handles");
    const { app, auditDbPath } = await start({ dataDir: dir, cursors: undefined, auditDbPath: join(dir, "audit.db"), anchorPath: join(dir, "anchors.log") });
    await app.ingest("t1");
    await app.search({ query: "needle", principal: { id: "alice", tenantId: "t1", groups: [] } });
    expect(sidecars(dir).length).toBeGreaterThan(0);
    await app.close();
    expect(existsSync(auditDbPath)).toBe(true);
    expect(sidecars(dir)).toEqual([]);
  });

  it("lets an in-flight search finish, refuses new ones, then frees the port", async () => {
    let started!: () => void;
    const began = new Promise<void>((r) => (started = r));
    const slow = async () => {
      started();
      await new Promise((r) => setTimeout(r, 300));
      return [1, 0];
    };
    const { app } = await start({ embedQuery: slow, drainMs: 5000 });
    await app.ingest("t1");
    const client = await connect(app.port, "alice:t1");
    const pending = call(client);
    await began;
    const port = app.port;
    const closing = app.close();
    expect(idsOf(await pending)).toEqual(["a", "b"]);
    await closing;
    await expect(fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST" })).rejects.toThrow();
  });

  it("gives up on a request that outlives the drain window", async () => {
    const { app } = await start({ embedQuery: () => new Promise(() => undefined), drainMs: 100, timeouts: { embedQueryMs: 60_000 } });
    await app.ingest("t1");
    const client = await connect(app.port, "alice:t1");
    void call(client).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 50));
    const began = Date.now();
    await app.close();
    expect(Date.now() - began).toBeLessThan(3000);
  });
});

describe("installShutdown", () => {
  it("exits 0 after a clean close and cancels the force-exit timer", async () => {
    const exits: number[] = [];
    const stop = installShutdown({ close: async () => undefined, forceExitMs: 50, exit: (c) => void exits.push(c), signals: [] });
    await stop();
    await new Promise((r) => setTimeout(r, 120));
    expect(exits).toEqual([0]);
  });
  it("force-exits with 1 when close hangs", async () => {
    const exits: number[] = [];
    const stop = installShutdown({ close: () => new Promise(() => undefined), forceExitMs: 50, exit: (c) => void exits.push(c), signals: [] });
    void stop();
    await new Promise((r) => setTimeout(r, 200));
    expect(exits).toEqual([1]);
  });
  it("exits 1 when close fails, and only once for repeated signals", async () => {
    const exits: number[] = [];
    const stop = installShutdown({ close: async () => Promise.reject(new Error("disk")), forceExitMs: 1000, exit: (c) => void exits.push(c), signals: [] });
    await Promise.all([stop(), stop()]);
    expect(exits).toEqual([1]);
  });
});
