import type { Pointer } from "@anvesx/core-types";

/** Every column the table has. None can hold document body text. */
export const COLUMNS = [
  "tenant_id",
  "id",
  "source",
  "address",
  "title",
  "version",
  "content_hash",
  "zone",
  "acl_json",
  "acl_version",
  "updated_at",
  "deleted_at",
] as const;

export const DDL = `CREATE TABLE IF NOT EXISTS pointers (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, source TEXT NOT NULL, address TEXT NOT NULL,
  title TEXT NOT NULL, version TEXT NOT NULL, content_hash TEXT NOT NULL, zone TEXT NOT NULL,
  acl_json TEXT NOT NULL, acl_version INTEGER NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
  PRIMARY KEY (tenant_id, id)
) WITHOUT ROWID`;

const SELECT_COLS = COLUMNS.join(", ");
const ALL = `SELECT ${SELECT_COLS} FROM pointers`;

/** All SQL the registry runs. Plain prepared statements, positional params. */
export const SQL = {
  one: `${ALL} WHERE tenant_id = ? AND id = ?`,
  insert: `INSERT INTO pointers (${COLUMNS.join(",")}) VALUES (${COLUMNS.map(() => "?").join(",")})`,
  update: `UPDATE pointers SET source=?, address=?, title=?, version=?, content_hash=?, zone=?, acl_json=?,
    acl_version=?, updated_at=?, deleted_at=? WHERE tenant_id=? AND id=?`,
  page: `${ALL} WHERE tenant_id = ? AND id > ? AND deleted_at IS NULL ORDER BY id LIMIT ?`,
  tombstone: "UPDATE pointers SET deleted_at = ? WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL",
} as const;

type Row = Record<string, unknown>;

/** Positional params in COLUMNS order. */
export const toParams = (p: Pointer): (string | number | null)[] => [
  p.tenantId,
  p.id,
  p.source,
  p.address,
  p.title,
  p.version,
  p.contentHash,
  p.zone,
  JSON.stringify({ allowUsers: p.acl.allowUsers, allowGroups: p.acl.allowGroups }),
  p.acl.version,
  p.updatedAt,
  p.deletedAt,
];

export const fromRow = (r: Row): Pointer => {
  const lists = JSON.parse(r["acl_json"] as string) as { allowUsers: string[]; allowGroups: string[] };
  return {
    id: r["id"] as string,
    tenantId: r["tenant_id"] as string,
    source: r["source"] as string,
    address: r["address"] as string,
    title: r["title"] as string,
    version: r["version"] as string,
    contentHash: r["content_hash"] as string,
    zone: r["zone"] as Pointer["zone"],
    acl: { allowUsers: lists.allowUsers, allowGroups: lists.allowGroups, version: r["acl_version"] as number },
    updatedAt: r["updated_at"] as string,
    deletedAt: r["deleted_at"] as string | null,
  };
};
