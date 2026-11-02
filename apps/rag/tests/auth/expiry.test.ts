import { describe, expect, it } from "vitest";
import { DEFAULT_TTL_SECONDS, mintToken, signedPrincipalFor, TokenExpiredError } from "../../src/auth/token.js";

const secret = "s".repeat(32);
const T0 = 1_800_000_000_000;
const bearer = (token: string) => ({ requestInfo: { headers: { authorization: `Bearer ${token}` } } });
const at = (ms: number) => signedPrincipalFor(secret, () => ms);

describe("token expiry", () => {
  it("mints user:tenant:exp:hmac with a one hour default", () => {
    const token = mintToken(secret, "alice", "acme", { now: () => T0 });
    expect(DEFAULT_TTL_SECONDS).toBe(3600);
    expect(token).toMatch(new RegExp(`^alice:acme:${T0 / 1000 + 3600}:[0-9a-f]{64}$`));
  });
  it("accepts a token before it expires and rejects it from the expiry second on", () => {
    const token = mintToken(secret, "alice", "acme", { now: () => T0 });
    const exp = T0 + 3600 * 1000;
    expect(at(exp - 1)(bearer(token))).toEqual({ id: "alice", tenantId: "acme", groups: [] });
    expect(() => at(exp)(bearer(token))).toThrow(TokenExpiredError);
    expect(() => at(exp + 86_400_000)(bearer(token))).toThrow(TokenExpiredError);
  });
  it("the expired error is typed and still reads as unauthenticated", () => {
    const token = mintToken(secret, "alice", "acme", { now: () => T0, ttlSeconds: 1 });
    try {
      at(T0 + 5000)(bearer(token));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TokenExpiredError);
      expect(error).toMatchObject({ name: "TokenExpiredError", code: "TOKEN_EXPIRED" });
      expect((error as Error).message).toContain("unauthenticated");
    }
  });
  it("honours a custom ttl", () => {
    const token = mintToken(secret, "alice", "acme", { now: () => T0, ttlSeconds: 60 });
    expect(at(T0 + 59_000)(bearer(token)).id).toBe("alice");
    expect(() => at(T0 + 60_000)(bearer(token))).toThrow(TokenExpiredError);
  });
  it("extending exp without the secret fails the signature, not the expiry", () => {
    const [user, tenant, exp, sig] = mintToken(secret, "alice", "acme", { now: () => T0 }).split(":");
    const forged = `${user}:${tenant}:${Number(exp) + 99999}:${sig}`;
    const error = (() => {
      try {
        at(T0)(bearer(forged));
      } catch (e) {
        return e;
      }
    })();
    expect(error).not.toBeInstanceOf(TokenExpiredError);
    expect((error as Error).message).toBe("unauthenticated");
  });
  it("an expired forged token reads as plain unauthenticated", () => {
    const forged = `alice:acme:1:${"0".repeat(64)}`;
    expect(() => at(T0)(bearer(forged))).toThrow(/^unauthenticated$/);
  });
  it("the old three-part format is rejected (breaking change)", () => {
    expect(() => at(T0)(bearer(`alice:acme:${"a".repeat(64)}`))).toThrow("unauthenticated");
  });
  it("refuses a ttl that is not a positive integer", () => {
    for (const ttlSeconds of [0, -1, 1.5, Number.NaN]) expect(() => mintToken(secret, "a", "b", { ttlSeconds })).toThrow("ttlSeconds");
  });
  it("defaults to the real clock", () => {
    expect(signedPrincipalFor(secret)(bearer(mintToken(secret, "alice", "acme"))).id).toBe("alice");
  });
});
