import { McpServiceError } from "../errors.js";

/** Host and Origin allow-lists that defeat DNS rebinding. Hosts include the port, as in the Host header. */
export type HostPolicy = { allowedHosts: string[]; allowedOrigins: string[] };
export type HostOptions = { allowedHosts?: string[] | undefined; allowedOrigins?: string[] | undefined };

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

export function defaultPolicy(port: number): HostPolicy {
  return {
    allowedHosts: LOOPBACK.map((h) => `${h}:${port}`),
    allowedOrigins: LOOPBACK.map((h) => `http://${h}:${port}`),
  };
}

export function resolvePolicy(port: number, given: HostOptions = {}): HostPolicy {
  if (given.allowedHosts?.length === 0) throw new McpServiceError("INVALID_CONFIG", "allowedHosts must not be empty");
  const base = defaultPolicy(port);
  return { allowedHosts: given.allowedHosts ?? base.allowedHosts, allowedOrigins: given.allowedOrigins ?? base.allowedOrigins };
}

/** A request must carry a listed Host; an Origin header, when present, must be listed too. */
export function hostAllowed(policy: HostPolicy, headers: { host?: string | undefined; origin?: string | undefined }): boolean {
  if (!headers.host || !policy.allowedHosts.includes(headers.host)) return false;
  return headers.origin === undefined || policy.allowedOrigins.includes(headers.origin);
}
