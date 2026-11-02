import { type Claims, format, need, sign } from "./claims.js";

export const DEFAULT_TTL_SECONDS = 3600;

export type MintOptions = {
  /** Milliseconds, like `Date.now`. Injected so tests control expiry. */
  now?: () => number;
  /** Lifetime in whole seconds. Default one hour. */
  ttlSeconds?: number;
  /** Signed into the token; the server grants exactly these groups. */
  groups?: string[];
  /** Names the verification key; `secret` must be that key's value. */
  kid?: string;
  /** Refuse to mint anything that lives longer than this. */
  maxLifetimeSeconds?: number;
};

/**
 * Bearer token value `user:tenant:exp[:groups:kid]:hmac-sha256-hex(key, payload)`, `exp` in epoch seconds.
 * Without groups or kid it is the original `user:tenant:exp:sig` form.
 */
export function mintToken(secret: string, user: string, tenant: string, opts: MintOptions = {}): string {
  const { now = Date.now, ttlSeconds = DEFAULT_TTL_SECONDS, groups = [], kid = "", maxLifetimeSeconds } = opts;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error("ttlSeconds must be a positive integer");
  if (maxLifetimeSeconds !== undefined && ttlSeconds > maxLifetimeSeconds) throw new Error(`ttl ${ttlSeconds}s is above the maximum of ${maxLifetimeSeconds}s`);
  const claims: Claims = { user, tenant, exp: String(Math.floor(now() / 1000) + ttlSeconds), groups, kid };
  const signature = sign(need(secret), claims);
  return format(claims, signature);
}
