import { contentHash, type ListedDoc } from "@brain/connector-kit";
import type { Pointer } from "@brain/core-types";
import type { ChangeEvent } from "@rag/connector-runtime";

/** Stable pointer id for one document of one connector. */
export const docId = (connectorId: string, address: string): string => contentHash(JSON.stringify([connectorId, address]));

/** Joins the runtime event, the listing metadata and the fetched text hash into a pointer. */
export function toPointer(event: ChangeEvent, listed: ListedDoc, textHash: string): Pointer {
  return {
    id: docId(event.connectorId, event.address),
    tenantId: event.tenantId,
    source: event.connectorId,
    address: event.address,
    title: event.title,
    version: event.version,
    contentHash: textHash,
    zone: listed.zone,
    acl: listed.acl,
    updatedAt: listed.updatedAt,
    deletedAt: null,
  };
}
