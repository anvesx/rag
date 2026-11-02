import { randomUUID } from "node:crypto";
import type { Principal } from "@brain/core-types";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer, type McpServerDeps } from "../build.js";
import { McpServiceError } from "../errors.js";
import type { HostPolicy } from "./guard.js";
import type { SessionLimits, Timers } from "./limits.js";

export type Session = { transport: StreamableHTTPServerTransport; server: McpServer; owner: Principal };
export type SessionsConfig = { limits: SessionLimits; timers: Timers; policy: HostPolicy };

const keyOf = (p: Principal) => JSON.stringify([p.tenantId, p.id]);

/** Live Streamable HTTP sessions, each pinned to the principal that opened it, capped and idle-expired. */
export class Sessions {
  private readonly byId = new Map<string, Session>();
  /** Every session from open() until it closes, including ones still initializing. */
  private readonly all = new Map<Session, unknown>();

  constructor(private readonly config: SessionsConfig) {}

  size = (): number => this.all.size;

  get(id: string): Session | undefined {
    const session = this.byId.get(id);
    if (session) this.arm(session);
    return session;
  }

  register = (id: string, session: Session): void => void this.byId.set(id, session);

  open(deps: McpServerDeps, owner: Principal): Session {
    const { maxSessions, maxSessionsPerPrincipal } = this.config.limits;
    const mine = [...this.all.keys()].filter((s) => keyOf(s.owner) === keyOf(owner)).length;
    if (this.all.size >= maxSessions || mine >= maxSessionsPerPrincipal) throw new McpServiceError("TOO_MANY_SESSIONS", "Too many sessions");
    const { policy } = this.config;
    const server = buildServer(deps);
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableDnsRebindingProtection: true,
      allowedHosts: policy.allowedHosts,
      allowedOrigins: policy.allowedOrigins,
      onsessioninitialized: (id) => this.register(id, session),
    });
    const session: Session = { transport, server, owner };
    transport.onclose = () => this.forget(session);
    this.arm(session);
    return session;
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.all.keys()].map((s) => this.expire(s)));
  }

  private arm(session: Session): void {
    this.disarm(session);
    this.all.set(
      session,
      this.config.timers.setTimeout(() => void this.expire(session), this.config.limits.idleTimeoutMs),
    );
  }

  private disarm(session: Session): void {
    if (this.all.has(session)) this.config.timers.clearTimeout(this.all.get(session));
  }

  private forget(session: Session): void {
    this.disarm(session);
    this.all.delete(session);
    for (const [id, s] of this.byId) if (s === session) this.byId.delete(id);
  }

  private async expire(session: Session): Promise<void> {
    this.forget(session);
    await session.server.close().catch(() => undefined);
    await session.transport.close().catch(() => undefined);
  }
}
