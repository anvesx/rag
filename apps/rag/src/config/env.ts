import { join } from "node:path";
import { MIN_SECRET_CHARS } from "../auth/claims.js";

export type Env = Record<string, string | undefined>;
export const CONNECTOR_KINDS = ["folder", "github", "drive"] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];
export type RagEnv = {
  port: number;
  auditDbPath: string;
  anchorPath: string;
  demo: boolean;
  /** Bind address. Absent: loopback. */
  host?: string;
  /** Host and Origin allow-lists (Host values include the port). Absent: loopback on the bound port. */
  allowedHosts?: string[];
  allowedOrigins?: string[];
  dataDir?: string;
  authSecret?: string;
  /** A directory of documents with `<name>.acl.json` sidecars, served as one tenant. */
  folderRoot?: string;
  /** Which source to serve (`RAG_CONNECTOR`). Absent with a folder root: folder. */
  connector?: ConnectorKind;
  tenant?: string;
  /** JSON file `{"tenant:user": "credential"}`: each user's own token at the source. */
  userTokensPath?: string;
};

const list = (raw: string | undefined): string[] | undefined =>
  raw === undefined
    ? undefined
    : raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

export function readEnv(env: Env): RagEnv {
  const raw = env.RAG_PORT ?? "3000";
  const port = Number(raw);
  if (!/^\d{1,5}$/.test(raw) || port > 65535) throw new Error(`invalid RAG_PORT: ${raw}`);
  const secret = env.RAG_AUTH_SECRET;
  if (secret !== undefined && secret.length < MIN_SECRET_CHARS) throw new Error(`RAG_AUTH_SECRET must be at least ${MIN_SECRET_CHARS} characters`);
  const dataDir = env.RAG_DATA_DIR || undefined;
  if (dataDir && secret === undefined)
    throw new Error("RAG_AUTH_SECRET is required when RAG_DATA_DIR is set: persistent data must not sit behind unsigned tokens");
  const kind = env.RAG_CONNECTOR || undefined;
  if (kind !== undefined && !(CONNECTOR_KINDS as readonly string[]).includes(kind))
    throw new Error(`invalid RAG_CONNECTOR: ${kind} (use ${CONNECTOR_KINDS.join(", ")})`);
  if (env.RAG_FOLDER_ROOT && !env.RAG_TENANT) throw new Error("RAG_TENANT is required with RAG_FOLDER_ROOT");
  if (kind && !env.RAG_TENANT) throw new Error("RAG_TENANT is required with RAG_CONNECTOR");
  const under = (name: string, fallback: string) => (dataDir ? join(dataDir, name) : fallback);
  const allowedHosts = list(env.RAG_ALLOWED_HOSTS);
  const allowedOrigins = list(env.RAG_ALLOWED_ORIGINS);
  return {
    ...(dataDir && { dataDir }),
    ...(secret !== undefined && { authSecret: secret }),
    ...(env.RAG_HOST && { host: env.RAG_HOST }),
    ...(allowedHosts && { allowedHosts }),
    ...(allowedOrigins && { allowedOrigins }),
    ...(env.RAG_FOLDER_ROOT && { folderRoot: env.RAG_FOLDER_ROOT }),
    ...((env.RAG_FOLDER_ROOT || kind) && { tenant: env.RAG_TENANT as string }),
    ...(kind && { connector: kind as ConnectorKind }),
    ...(env.RAG_USER_TOKENS && { userTokensPath: env.RAG_USER_TOKENS }),
    port,
    auditDbPath: env.RAG_AUDIT_DB ?? under("audit.db", "rag-audit.db"),
    anchorPath: env.RAG_ANCHOR ?? under("anchors.log", "rag-anchors.log"),
    demo: env.RAG_DEMO === "1",
  };
}
