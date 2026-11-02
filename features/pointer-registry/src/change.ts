import type { Pointer } from "@anvesx/core-types";

const same = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
};

/** Nothing to write only when every stored field is equal (ACL lists as sets); updatedAt alone is not a change. */
export const isUnchanged = (o: Pointer, n: Pointer): boolean =>
  o.contentHash === n.contentHash &&
  o.version === n.version &&
  o.deletedAt === n.deletedAt &&
  o.zone === n.zone &&
  o.address === n.address &&
  o.title === n.title &&
  o.source === n.source &&
  o.acl.version === n.acl.version &&
  same(o.acl.allowUsers, n.acl.allowUsers) &&
  same(o.acl.allowGroups, n.acl.allowGroups);
