import { createCursorStore } from "@rag/change-cursor";
import { readTokenPolicy } from "../auth/mode.js";
import { signedPrincipalFor } from "../auth/token.js";
import { DEMO_TENANT, type DemoDeps, demoDeps, type Env, embedText, type RagEnv } from "../config/index.js";
import { realEmbedding } from "../wire/embedder.js";
import { type Built, connectorFromEnv } from "./connectors.js";
import { userTokensFor } from "./user-tokens.js";

export type Source = DemoDeps & { tenants: string[] };

/**
 * What to serve: the connector chosen by RAG_CONNECTOR (folder, github or drive; a folder root alone means folder)
 * as the one tenant RAG_TENANT, otherwise the demo. Every mode except RAG_DEMO=1 embeds with the real local model.
 */
export function sourceFor(rag: RagEnv, env: Env, now: () => number = Date.now): Source {
  const built = connectorFromEnv(rag, env);
  const base = built && rag.tenant ? fromConnector(built, rag, env) : { ...demoDeps(), tenants: [DEMO_TENANT] };
  if (!rag.authSecret) return base;
  return { ...base, principalFor: signedPrincipalFor(rag.authSecret, now, readTokenPolicy(env)) };
}

function fromConnector({ connector, token }: Built, rag: RagEnv, env: Env): Source {
  const tenant = rag.tenant as string;
  const userTokenFor = userTokensFor(connector, rag.userTokensPath);
  const embedding = rag.demo
    ? { embed: async (texts: string[]) => texts.map(embedText), embedQuery: async (text: string) => embedText(text) }
    : realEmbedding(env.RAG_EMBEDDER_CACHE_DIR || undefined);
  return {
    connectorFor: (id) => (id === tenant ? connector : undefined),
    tokenFor: (id) => (id === tenant ? token : undefined),
    ...(rag.dataDir === undefined && { cursors: createCursorStore(":memory:", Date.now) }),
    ...(userTokenFor && { userTokenFor }),
    ...embedding,
    clock: Date.now,
    principalFor: () => {
      throw new Error("unauthenticated");
    },
    tenants: [tenant],
  };
}
