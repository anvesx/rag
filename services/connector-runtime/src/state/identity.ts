import { contentHash, type ListedDoc } from "@brain/connector-kit";

const canon = (ids: string[]): string[] => [...new Set(ids)].sort();

/** Event identity: connector, address, version and the ACL (lists as sets, plus its version). */
export const eventIdOf = (connectorId: string, item: ListedDoc): string =>
  contentHash(JSON.stringify([connectorId, item.address, item.version, canon(item.acl.allowUsers), canon(item.acl.allowGroups), item.acl.version]));
