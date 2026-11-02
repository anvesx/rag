import type { Acl, Principal } from "@anvesx/core-types";

/** Pure twin of allowClause. Deny by default. */
export function isAllowed(p: Principal, acl: Acl, rowTenant: string): boolean {
  if (p.tenantId !== rowTenant) return false;
  if (acl.allowUsers.includes(p.id)) return true;
  const granted = new Set(acl.allowGroups);
  return p.groups.some((g) => granted.has(g));
}
