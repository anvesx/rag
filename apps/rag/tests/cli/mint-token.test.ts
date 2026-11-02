import { describe, expect, it } from "vitest";
import { signedPrincipalFor } from "../../src/auth/token.js";
import { mintTokenCli } from "../../src/cli/mint-token.js";

const secret = "m".repeat(32);
const T0 = 1_800_000_000_000;
const bearer = (token: string) => ({ requestInfo: { headers: { authorization: `Bearer ${token}` } } });
const run = (argv: string[], env: Record<string, string> = { RAG_AUTH_SECRET: secret }) => mintTokenCli(argv, env, () => T0);

describe("rag mint-token", () => {
  it("mints a token the server accepts, with groups", () => {
    const token = run(["--user", "alice", "--tenant", "acme", "--groups", "eng,ops"]);
    expect(signedPrincipalFor(secret, () => T0)(bearer(token))).toEqual({ id: "alice", tenantId: "acme", groups: ["eng", "ops"] });
  });
  it("defaults to one hour and honours --ttl", () => {
    expect(run(["--user", "a", "--tenant", "t"]).split(":")[2]).toBe(String(T0 / 1000 + 3600));
    expect(run(["--user", "a", "--tenant", "t", "--ttl", "60"]).split(":")[2]).toBe(String(T0 / 1000 + 60));
  });
  it("refuses a ttl above the configured maximum", () => {
    const env = { RAG_AUTH_SECRET: secret, RAG_TOKEN_MAX_TTL_SECONDS: "120" };
    expect(() => run(["--user", "a", "--tenant", "t", "--ttl", "121"], env)).toThrow("maximum");
    expect(run(["--user", "a", "--tenant", "t"], env).split(":")[2]).toBe(String(T0 / 1000 + 120));
  });
  it("signs with the key named by --kid", () => {
    const other = "o".repeat(32);
    const env = { RAG_AUTH_SECRET: secret, RAG_AUTH_KEYS: JSON.stringify({ k2: other }) };
    const token = run(["--user", "a", "--tenant", "t", "--kid", "k2"], env);
    expect(signedPrincipalFor(secret, () => T0, { keys: { k2: other } })(bearer(token)).id).toBe("a");
    expect(() => run(["--user", "a", "--tenant", "t", "--kid", "nope"], env)).toThrow("kid");
  });
  it("needs a secret, a user and a tenant, and rejects unknown flags", () => {
    expect(() => run(["--user", "a", "--tenant", "t"], {})).toThrow("RAG_AUTH_SECRET");
    expect(() => run(["--tenant", "t"])).toThrow("--user");
    expect(() => run(["--user", "a"])).toThrow("--tenant");
    expect(() => run(["--user", "a", "--tenant", "t", "--bogus", "x"])).toThrow("--bogus");
  });
});
