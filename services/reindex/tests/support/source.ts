import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Connector, createFolderConnector } from "@anvesx/connector-kit";
import { RankIndex } from "@rag/rank";
import { afterEach } from "vitest";
import { type Gate, reindex, type SourceDoc } from "../../src/reindex.js";

export const TOKEN = "asker-token";
const dirs: string[] = [];
const indexes: RankIndex[] = [];

afterEach(() => {
  for (const ix of indexes.splice(0)) ix.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

export const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "reindex-"));
  dirs.push(d);
  return d;
};

export const openRank = (path: string): RankIndex => {
  const r = RankIndex.open(path, { key: "reindex-test-key-0123456789abc" });
  indexes.push(r);
  return r;
};

/** Writes a document with a body and an ACL sidecar (the folder convention). */
export const put = (root: string, address: string, body: string, users: string[] = [], groups: string[] = []): void => {
  const file = join(root, address);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  writeFileSync(`${file}.acl.json`, JSON.stringify({ allowUsers: users, allowGroups: groups, version: 1 }));
};

/** What a metadata source reports for a connector: its listing, with readers as `user:` and `team:` principals. */
export const listDocs = async (c: Connector): Promise<SourceDoc[]> => {
  const out: SourceDoc[] = [];
  for (let cursor: string | undefined; ; ) {
    const page = await c.list({ limit: 100, ...(cursor ? { cursor } : {}) });
    for (const i of page.items) {
      const readers = [...i.acl.allowUsers.map((u) => `user:${u}`), ...i.acl.allowGroups.map((g) => `team:${g}`)].sort();
      out.push({ id: `${c.id}/${i.address}`, title: i.title, address: i.address, version: i.version, updatedAt: i.updatedAt, readers });
    }
    cursor = page.nextCursor;
    if (cursor === undefined) return out;
  }
};

/** One real stack in temp files: a folder of documents and a rank file. */
export function stack(): {
  root: string;
  ix: RankIndex;
  known: Map<string, string>;
  index(opts?: { gate?: Gate; connector?: Connector }): ReturnType<typeof reindex>;
} {
  const [root, base] = [tmp(), tmp()];
  const ix = openRank(join(base, "rank.db"));
  const known = new Map<string, string>();
  const index = async (o: { gate?: Gate; connector?: Connector } = {}) => {
    const connector = o.connector ?? createFolderConnector("docs", root);
    return reindex({ docs: await listDocs(connector), connector, token: TOKEN, index: ix, known, ...(o.gate ? { gate: o.gate } : {}) });
  };
  return { root, ix, known, index };
}
