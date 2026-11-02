import { createHmac } from "node:crypto";

export const MIN_SECRET_CHARS = 32;
const NAME = /^[^:,\s]+$/;
export const KID = /^[A-Za-z0-9_.-]+$/;
/** `user:tenant:exp:sig` (no groups, no kid). */
const LEGACY = /^Bearer ([^:\s]+):([^:\s]+):(\d{1,12}):([0-9a-f]{64})$/;
/** `user:tenant:exp:groups:kid:sig`; groups comma-separated, both may be empty. */
const EXTENDED = /^Bearer ([^:\s]+):([^:\s]+):(\d{1,12}):([^:\s]*):([^:\s]*):([0-9a-f]{64})$/;

export type Claims = { user: string; tenant: string; exp: string; groups: string[]; kid: string };

export function need(secret: string): string {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_CHARS) throw new Error(`RAG_AUTH_SECRET must be at least ${MIN_SECRET_CHARS} characters`);
  return secret;
}

/** Legacy and extended payloads differ in field count and fields never contain a colon, so a signature cannot move between forms. */
const payload = (c: Claims): string =>
  c.groups.length === 0 && c.kid === "" ? `${c.user}:${c.tenant}:${c.exp}` : `${c.user}:${c.tenant}:${c.exp}:${c.groups.join(",")}:${c.kid}`;

export const sign = (key: string, c: Claims): string => createHmac("sha256", key).update(payload(c)).digest("hex");

/** The wire form of a token, throwing on a field that would break the format. */
export function format(c: Claims, signature: string): string {
  if (c.user.includes(":") || c.tenant.includes(":")) throw new Error("user and tenant must not contain a colon");
  for (const g of c.groups) if (!NAME.test(g)) throw new Error(`invalid group ${JSON.stringify(g)}: no colon, comma or whitespace`);
  if (c.kid !== "" && !KID.test(c.kid)) throw new Error(`invalid kid ${JSON.stringify(c.kid)}`);
  const head = `${c.user}:${c.tenant}:${c.exp}`;
  return c.groups.length === 0 && c.kid === "" ? `${head}:${signature}` : `${head}:${c.groups.join(",")}:${c.kid}:${signature}`;
}

/** Parses an Authorization header, or undefined when it matches neither form. Does not verify. */
export function parse(header: string): { claims: Claims; signature: string } | undefined {
  const old = LEGACY.exec(header);
  if (old) return { claims: { user: old[1] as string, tenant: old[2] as string, exp: old[3] as string, groups: [], kid: "" }, signature: old[4] as string };
  const m = EXTENDED.exec(header);
  if (!m) return undefined;
  const groups = m[4] === "" ? [] : (m[4] as string).split(",");
  if (groups.some((g) => !NAME.test(g)) || (m[5] !== "" && !KID.test(m[5] as string))) return undefined;
  return { claims: { user: m[1] as string, tenant: m[2] as string, exp: m[3] as string, groups, kid: m[5] as string }, signature: m[6] as string };
}
