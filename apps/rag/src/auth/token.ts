import { timingSafeEqual } from "node:crypto";
import type { Principal } from "@brain/core-types";
import { need, parse, sign } from "./claims.js";

export { MIN_SECRET_CHARS } from "./claims.js";
export { DEFAULT_TTL_SECONDS, type MintOptions, mintToken } from "./mint.js";

/** A correctly signed token past its `exp`. The message starts with "unauthenticated" so generic handlers treat it as such. */
export class TokenExpiredError extends Error {
  readonly code = "TOKEN_EXPIRED";
  constructor() {
    super("unauthenticated: token expired");
    this.name = "TokenExpiredError";
  }
}

export type TokenPolicy = {
  /** Extra verification keys by kid. A token with no kid always uses the primary secret. */
  keys?: Record<string, string>;
  /** Reject tokens whose expiry is further out than this many seconds from now. */
  maxLifetimeSeconds?: number;
};

/**
 * principalFor that accepts only correctly signed, unexpired tokens. Anything else throws "unauthenticated";
 * a valid signature past `exp` throws `TokenExpiredError`. Groups come only from the signed token. `now` is in milliseconds.
 */
export function signedPrincipalFor(secret: string, now: () => number = Date.now, policy: TokenPolicy = {}): (extra: unknown) => Principal {
  need(secret);
  return (extra) => {
    const headers = (extra as { requestInfo?: { headers?: Record<string, string | undefined> } }).requestInfo?.headers;
    const parsed = parse(headers?.authorization ?? "");
    if (!parsed) throw new Error("unauthenticated");
    const { claims, signature } = parsed;
    const key = claims.kid === "" ? secret : policy.keys?.[claims.kid];
    if (key === undefined) throw new Error("unauthenticated");
    const want = Buffer.from(sign(key, claims), "hex");
    const got = Buffer.from(signature, "hex");
    if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error("unauthenticated");
    const remaining = Number(claims.exp) - Math.floor(now() / 1000);
    if (remaining <= 0) throw new TokenExpiredError();
    if (policy.maxLifetimeSeconds !== undefined && remaining > policy.maxLifetimeSeconds) throw new Error("unauthenticated: lifetime exceeds the maximum");
    return { id: claims.user, tenantId: claims.tenant, groups: claims.groups };
  };
}
