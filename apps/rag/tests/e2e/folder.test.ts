import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { mintToken } from "../../src/auth/token.js";
import { startFromEnv } from "../../src/cli/serve.js";
import { call, connect, idsOf } from "../harness.js";

const root = mkdtempSync(join(tmpdir(), "rag-folder-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const secret = "f".repeat(32);

function corpus(): string {
  const dir = join(root, "corpus");
  mkdirSync(join(dir, "hr"), { recursive: true });
  const put = (name: string, text: string, acl?: { allowUsers: string[]; allowGroups: string[] }) => {
    writeFileSync(join(dir, name), text);
    if (acl) writeFileSync(join(dir, `${name}.acl.json`), JSON.stringify({ ...acl, version: 1 }));
  };
  put("handbook.md", "needle handbook for everyone in eng", { allowUsers: ["alice"], allowGroups: ["eng"] });
  put("hr/salaries.md", "needle salary bands", { allowUsers: ["hrbot"], allowGroups: ["hr"] });
  put("orphan.md", "needle with no acl sidecar");
  return dir;
}

async function boot(name: string) {
  const env = {
    RAG_FOLDER_ROOT: corpus(),
    RAG_TENANT: "acme",
    RAG_DATA_DIR: join(root, name),
    RAG_AUTH_SECRET: secret,
    RAG_AUDIT_KEY: "k".repeat(32),
    RAG_PORT: "0",
    RAG_HEALTH_PORT: "0",
  };
  return startFromEnv(env, { log: () => undefined, error: () => undefined });
}

const ask = async (port: number | undefined, token: string) => {
  const client = await connect(port, token);
  const found = idsOf(await call(client));
  await client.close();
  return found;
};

// Folder mode embeds with the real model like every non-demo mode; RAG_EMBEDDER_OFFLINE=1 skips it (see @rag/embedder).
describe.skipIf(process.env.RAG_EMBEDDER_OFFLINE === "1")("RAG_FOLDER_ROOT end to end over real HTTP and real SQLite files", () => {
  it("serves only what the sidecar ACLs allow; a denied user gets nothing", async () => {
    const { app } = await boot("serve");
    const tok = (user: string, groups: string[] = []) => mintToken(secret, user, "acme", { groups });
    expect(await ask(app.port, tok("alice"))).toEqual(["handbook.md"]);
    expect(await ask(app.port, tok("carol", ["eng"]))).toEqual(["handbook.md"]);
    expect(await ask(app.port, tok("hrbot"))).toEqual(["hr/salaries.md"]);
    expect(await ask(app.port, tok("mallory"))).toEqual([]);
    expect(await ask(app.port, tok("mallory", ["sales"]))).toEqual([]);
    expect(await ask(app.port, mintToken(secret, "alice", "globex"))).toEqual([]);
    await app.close();
  });

  it("rejects an unsigned bearer token", async () => {
    const { app } = await boot("auth");
    const res = await fetch(`http://127.0.0.1:${app.port}/mcp`, { method: "POST", headers: { authorization: "Bearer alice:acme" } });
    expect(res.status).toBe(401);
    await app.close();
  });
});
