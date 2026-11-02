import { describe, expect, it } from "vitest";
import { mintToken, signedPrincipalFor, TokenExpiredError } from "../../src/auth/token.js";

const secret = "s".repeat(32);
const other = "o".repeat(32);
const T0 = 1_800_000_000_000;
const bearer = (token: string) => ({ requestInfo: { headers: { authorization: `Bearer ${token}` } } });
const verify = (policy = {}, now = T0) => signedPrincipalFor(secret, () => now, policy);
const mint = (opts = {}) => mintToken(secret, "alice", "acme", { now: () => T0, ...opts });

describe("signed groups claim", () => {
  it("carries groups in the signed token", () => {
    const token = mint({ groups: ["eng", "ops"] });
    expect(token).toMatch(/^alice:acme:\d+:eng,ops::[0-9a-f]{64}$/);
    expect(verify()(bearer(token))).toEqual({ id: "alice", tenantId: "acme", groups: ["eng", "ops"] });
  });
  it("a token without groups or kid keeps the legacy four-part form", () => {
    expect(mint()).toMatch(/^alice:acme:\d+:[0-9a-f]{64}$/);
  });
  it("editing the groups invalidates the signature", () => {
    const [user, tenant, exp, , kid, sig] = mint({ groups: ["eng"] }).split(":");
    expect(() => verify()(bearer([user, tenant, exp, "eng,admins", kid, sig].join(":")))).toThrow("unauthenticated");
  });
  it("stripping the groups to reach the legacy form does not verify", () => {
    const [user, tenant, exp, , , sig] = mint({ groups: ["eng"] }).split(":");
    expect(() => verify()(bearer([user, tenant, exp, sig].join(":")))).toThrow("unauthenticated");
  });
  it("refuses groups that would break the format", () => {
    for (const g of ["a:b", "a,b", "a b", ""]) expect(() => mint({ groups: [g] })).toThrow("group");
  });
});

describe("kid and key rotation", () => {
  const keys = { k2: other };
  const asK2 = (key = other, kid = "k2") => mintToken(key, "alice", "acme", { now: () => T0, kid });
  it("verifies a kid token against the key ring", () => {
    expect(asK2()).toMatch(/^alice:acme:\d+::k2:[0-9a-f]{64}$/);
    expect(verify({ keys })(bearer(asK2()))).toEqual({ id: "alice", tenantId: "acme", groups: [] });
  });
  it("rejects an unknown kid and a kid signed with the wrong key", () => {
    expect(() => verify({ keys })(bearer(asK2(other, "k9")))).toThrow("unauthenticated");
    expect(() => verify({ keys })(bearer(asK2(secret)))).toThrow("unauthenticated");
    expect(() => verify()(bearer(asK2()))).toThrow("unauthenticated");
  });
  it("tokens without a kid still verify with the primary secret", () => {
    expect(verify({ keys })(bearer(mint())).id).toBe("alice");
  });
});

describe("maximum lifetime", () => {
  it("rejects a token whose expiry is further out than the maximum", () => {
    const policy = { maxLifetimeSeconds: 600 };
    expect(verify(policy)(bearer(mint({ ttlSeconds: 600 }))).id).toBe("alice");
    expect(() => verify(policy)(bearer(mint({ ttlSeconds: 601 })))).toThrow("unauthenticated: lifetime");
  });
  it("expiry is still reported as expiry", () => {
    expect(() => verify({ maxLifetimeSeconds: 600 }, T0 + 700_000)(bearer(mint({ ttlSeconds: 600 })))).toThrow(TokenExpiredError);
  });
  it("mintToken refuses a ttl above its own maximum", () => {
    expect(() => mint({ ttlSeconds: 601, maxLifetimeSeconds: 600 })).toThrow("maximum");
  });
});
