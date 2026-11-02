import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { mintToken } from "../../src/auth/token.js";
import { startFromEnv } from "../../src/cli/serve.js";
import { call, connect, idsOf } from "../harness.js";

const root = mkdtempSync(join(tmpdir(), "rag-live-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const secret = "l".repeat(32);
const { GITHUB_TOKEN: ghToken, GITHUB_TEST_REPO: ghRepo, GITHUB_TEST_USER: ghUser, DRIVE_ACCESS_TOKEN: driveToken, DRIVE_TEST_USER: driveUser } = process.env;

async function liveRun(name: string, source: Record<string, string>, user: string, token: string) {
  const tokens = join(root, `${name}.json`);
  writeFileSync(tokens, JSON.stringify({ [`acme:${user}`]: token }));
  const env = {
    RAG_TENANT: "acme",
    RAG_DATA_DIR: join(root, name),
    RAG_AUTH_SECRET: secret,
    RAG_AUDIT_KEY: "k".repeat(32),
    RAG_USER_TOKENS: tokens,
    RAG_PORT: "0",
    ...source,
  };
  const { app } = await startFromEnv(env, { log: () => undefined, error: () => undefined });
  const asUser = async (id: string) => {
    const client = await connect(app.port, mintToken(secret, id, "acme"));
    const found = idsOf(await call(client, "document"));
    await client.close();
    return found;
  };
  try {
    expect((await asUser(user)).length).toBeGreaterThan(0);
    expect(await asUser("nobody-at-all")).toEqual([]);
  } finally {
    await app.close();
  }
}

// Real APIs, real model, real accounts. Skipped unless the credentials are set (names as in services/connectors/tests/integration).
describe.skipIf(!ghToken || !ghRepo || !ghUser)("github live: GITHUB_TOKEN, GITHUB_TEST_REPO=owner/repo, GITHUB_TEST_USER=<login of the token's owner>", () => {
  it("indexes the repo and serves it to a collaborator only", async () => {
    await liveRun("gh", { RAG_CONNECTOR: "github", GITHUB_TOKEN: ghToken ?? "", RAG_GITHUB_REPO: ghRepo ?? "" }, ghUser ?? "", ghToken ?? "");
  }, 300_000);
});

describe.skipIf(!driveToken || !driveUser)("drive live: DRIVE_ACCESS_TOKEN, DRIVE_TEST_USER=<email of the token's owner>", () => {
  it("indexes the drive and serves it to a grantee only", async () => {
    await liveRun("drive", { RAG_CONNECTOR: "drive", DRIVE_ACCESS_TOKEN: driveToken ?? "" }, driveUser ?? "", driveToken ?? "");
  }, 300_000);
});
