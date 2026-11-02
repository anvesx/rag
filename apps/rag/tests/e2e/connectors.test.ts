import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { mintToken } from "../../src/auth/token.js";
import { startFromEnv } from "../../src/cli/serve.js";
import { call, connect, idsOf } from "../harness.js";
import type { Replay } from "../support/replay.js";
import { INDEX_TOKEN, replayDrive, replayGithub } from "../support/sources.js";

const root = mkdtempSync(join(tmpdir(), "rag-connectors-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const secret = "c".repeat(32);

async function boot(name: string, extra: Record<string, string>, users: Record<string, string>) {
  const tokens = join(root, `${name}-tokens.json`);
  writeFileSync(tokens, JSON.stringify(users), { mode: 0o600 });
  return startFromEnv(
    {
      RAG_TENANT: "acme",
      RAG_DATA_DIR: join(root, name),
      RAG_AUTH_SECRET: secret,
      RAG_AUDIT_KEY: "k".repeat(32),
      RAG_USER_TOKENS: tokens,
      RAG_PORT: "0",
      RAG_HEALTH_PORT: "0",
      ...extra,
    },
    { log: () => undefined, error: () => undefined },
  );
}

const ask = async (port: number | undefined, user: string, tenant = "acme") => {
  const client = await connect(port, mintToken(secret, user, tenant));
  const found = idsOf(await call(client));
  await client.close();
  return found;
};

// The real SDKs talk to a local HTTP server; the embedder is the real 384-D model, so these need it downloadable (see @rag/embedder).
describe.skipIf(process.env.RAG_EMBEDDER_OFFLINE === "1")("connector -> ingest -> real embedder -> search over MCP", () => {
  it("github: the user's own token is checked live, and a denied user gets nothing", async () => {
    const replay: Replay = await replayGithub();
    const { app } = await boot(
      "github",
      { RAG_CONNECTOR: "github", GITHUB_TOKEN: INDEX_TOKEN, RAG_GITHUB_REPO: "acme/handbook", RAG_GITHUB_API_URL: replay.url },
      { "acme:alice": "alice-token", "acme:bob": "bob-token" },
    );
    try {
      expect((await fetch(`http://127.0.0.1:${app.healthPort}/readyz`)).status).toBe(200); // the model loaded
      expect(await ask(app.port, "alice")).toEqual(["guide.md"]);
      expect(await ask(app.port, "bob")).toEqual([]); // on the ACL, but his own token no longer reads it at the source
      expect(await ask(app.port, "mallory")).toEqual([]); // not on the ACL
      expect(await ask(app.port, "alice", "globex")).toEqual([]);
      expect(replay.seen.some((r) => r.authorization === "token alice-token")).toBe(true);
      expect(replay.seen.some((r) => r.authorization === "token bob-token")).toBe(true);
    } finally {
      await app.close();
      await replay.close();
    }
  });

  it("drive: same path through the Drive SDK, users keyed by email", async () => {
    const replay: Replay = await replayDrive();
    const { app } = await boot(
      "drive",
      { RAG_CONNECTOR: "drive", DRIVE_ACCESS_TOKEN: INDEX_TOKEN, RAG_DRIVE_ROOT_URL: `${replay.url}/` },
      { "acme:alice@acme.test": "alice-token", "acme:bob@acme.test": "bob-token" },
    );
    try {
      expect(await ask(app.port, "alice@acme.test")).toEqual(["doc1"]);
      expect(await ask(app.port, "bob@acme.test")).toEqual([]);
      expect(await ask(app.port, "mallory@evil.test")).toEqual([]);
      expect(replay.seen.some((r) => r.authorization === "Bearer alice-token")).toBe(true);
    } finally {
      await app.close();
      await replay.close();
    }
  });
});
