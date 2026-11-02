import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export type Server = { url: string; stop: () => Promise<number | null> };

const bin = resolve(import.meta.dirname, "../../../apps/rag/dist/bin.js");

export const startServer = (): Promise<Server> =>
  new Promise((done, fail) => {
    const dir = mkdtempSync(join(tmpdir(), "rag-e2e-"));
    const env = { ...process.env, RAG_DEMO: "1", RAG_PORT: "0", RAG_AUDIT_DB: join(dir, "audit.db"), RAG_ANCHOR: join(dir, "anchor") };
    const child: ChildProcess = spawn("node", [bin], { env });
    const timer = setTimeout(() => fail(new Error("rag did not start in 10s")), 10_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const url = /listening on (http:\/\/\S+)/.exec(chunk.toString())?.[1];
      if (!url) return;
      clearTimeout(timer);
      const exited = new Promise<number | null>((ok) => child.once("exit", (code) => ok(code)));
      done({
        url,
        stop: () => {
          child.kill("SIGTERM");
          return exited;
        },
      });
    });
    child.once("exit", (code) => fail(new Error(`rag exited early with ${code}`)));
  });
