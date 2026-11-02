import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FakeDoc } from "@brain/connector-kit";
import type { Principal } from "@brain/core-types";

export const principal = (id: string, tenantId: string, groups: string[] = []): Principal => ({ id, tenantId, groups });

export const doc = (address: string, users: string[], text = "needle", groups: string[] = [], over: Partial<FakeDoc> = {}): FakeDoc => ({
  address,
  title: address,
  version: "v1",
  acl: { allowUsers: users, allowGroups: groups, version: 1 },
  zone: "team",
  updatedAt: "2026-11-01T00:00:00.000Z",
  text,
  ...over,
});

export const addresses = (pointers: Array<{ address: string }>): string[] => pointers.map((p) => p.address).sort();

/** Temp directories under os.tmpdir(); `cleanup` removes every one made. Tests write nowhere else. */
export function scratch() {
  const made: string[] = [];
  return {
    make: (): string => {
      const dir = mkdtempSync(join(tmpdir(), "rag-integration-"));
      made.push(dir);
      return dir;
    },
    cleanup: (): void => {
      for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Edit the audit file behind the stack's back, after dropping its append-only triggers. */
export function tamper(path: string, sql: string): void {
  const h = new DatabaseSync(path);
  h.exec("DROP TRIGGER audit_no_update");
  h.exec("DROP TRIGGER audit_no_delete");
  h.exec(sql);
  h.close();
}
