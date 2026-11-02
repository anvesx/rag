import type { Connector, FakeDoc } from "@anvesx/connector-kit";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { createCursorStore } from "@rag/change-cursor";
import { chunkText } from "@rag/chunker";
import { createSearchIndex } from "@rag/hybrid-search";
import { createIndexService, type IndexDeps, type IndexService } from "@rag/index-service";
import { createRegistry } from "@rag/pointer-registry";
import { createIngestion, type IngestionDeps } from "../../src/index.js";

export const doc = (address: string, version = "v1", text = `text of ${address}`): FakeDoc => ({
  address,
  title: address,
  version,
  acl: { allowUsers: ["u1"], allowGroups: [], version: 1 },
  zone: "personal",
  updatedAt: "2026-01-01T00:00:00.000Z",
  text,
});

/** A connector whose document set can change between runs. */
export function mutableConnector(initial: FakeDoc[]) {
  let inner = createFakeConnector("fake", initial);
  const tokens: string[] = [];
  const broken = new Set<string>();
  const connector: Connector = {
    id: "fake",
    list: (q) => inner.list(q),
    fetch: (a, c) => {
      tokens.push(c.token);
      if (broken.has(a)) return Promise.reject(new Error(`fetch failed: ${a}`));
      return inner.fetch(a, c);
    },
  };
  const set = (docs: FakeDoc[]) => {
    inner = createFakeConnector("fake", docs);
  };
  return { connector, set, tokens, broken };
}

/** `tenants` limits which tenants resolve to the connector; default is every tenant. */
export function setup(initial: FakeDoc[], wrap: (svc: IndexService) => IndexService = (s) => s, tenants?: string[], extra: Partial<IngestionDeps> = {}) {
  const registry = createRegistry(":memory:");
  const index = createSearchIndex(":memory:", 3);
  const mine = mutableConnector(initial);
  const state = { failEmbed: false };
  const deps: IndexDeps = {
    registry,
    index,
    chunk: (id, text) => chunkText(id, text, { size: 40, overlap: 5 }),
    fetchText: async (p) => (await mine.connector.fetch(p.address, { token: "t" })).text,
    embed: async (ts) => {
      if (state.failEmbed) throw new Error("embed down");
      return ts.map((t) => [t.length % 7, 1, 2]);
    },
  };
  const cursors = createCursorStore(":memory:", () => 1000);
  const make = (known?: IngestionDeps["known"], over: Partial<IngestionDeps> = {}) =>
    createIngestion({
      runtime: { cursors, clock: () => 1000, pageSize: 2 },
      connectorFor: (t) => (!tenants || tenants.includes(t) ? mine.connector : undefined),
      tokenFor: (t) => (!tenants || tenants.includes(t) ? `token-${t}` : undefined),
      indexService: wrap(createIndexService(deps)),
      ...extra,
      ...over,
      ...(known && { known }),
    });
  const rows = (tenantId = "acme") => registry.list({ tenantId, limit: 1000 });
  /** `reopen` simulates a restart: a new ingestion over the same stores with an empty in-memory known set. */
  const search = (text: string, tenantId = "acme") =>
    index.search({ text, embedding: [1, 1, 1], limit: 50, acl: { sql: "tenant_id = ?", params: [tenantId] } });
  return { ...mine, ingestion: make(), reopen: make, registry, state, cursors, rows, search };
}
