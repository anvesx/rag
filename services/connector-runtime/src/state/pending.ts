import type { CursorStore } from "@rag/change-cursor";

/** Persists the ids of events whose delivery is unconfirmed, as a JSON array under one cursor key. */
export function pendingStore(cursors: CursorStore, key: string) {
  return {
    pending: (tenantId: string): string[] => JSON.parse(cursors.getCursor(tenantId, key) || "[]") as string[],
    setPending: (tenantId: string, ids: string[]): void => cursors.setCursor(tenantId, key, ids.length === 0 ? "" : JSON.stringify(ids)),
  };
}
