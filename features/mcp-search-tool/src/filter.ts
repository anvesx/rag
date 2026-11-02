import type { Pointer, Principal } from "@brain/core-types";

/** Defence in depth: the search backend should already enforce this, but never return tombstoned or cross-tenant pointers. */
export function visibleTo(principal: Principal, pointers: readonly Pointer[]): Pointer[] {
  return pointers.filter((pointer) => pointer.deletedAt === null && pointer.tenantId === principal.tenantId);
}
