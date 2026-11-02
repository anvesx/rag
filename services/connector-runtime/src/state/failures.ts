import type { CursorStore } from "@rag/change-cursor";
import type { Failure } from "../types.js";

const MAX_DEAD = 20;
const MAX_ERROR_CHARS = 60;
const short = (id: string): string => id.slice(0, 16);

type Dead = { i: string; a: string; e: string };

/** Per-tenant retry counts and the quarantine list, each one JSON value under a cursor key (4096-char cap). */
export function failureStore(cursors: CursorStore, base: string) {
  const attemptsKey = `${base}#attempts`;
  const deadKey = `${base}#dead`;
  const read = <T>(tenantId: string, key: string, empty: T): T => {
    const raw = cursors.getCursor(tenantId, key);
    return raw ? (JSON.parse(raw) as T) : empty;
  };
  const write = (tenantId: string, key: string, value: unknown, empty: boolean) => cursors.setCursor(tenantId, key, empty ? "" : JSON.stringify(value));
  const attempts = (tenantId: string) => read<Record<string, number>>(tenantId, attemptsKey, {});
  const dead = (tenantId: string) => read<Dead[]>(tenantId, deadKey, []);

  return {
    isDead: (tenantId: string, id: string): boolean => dead(tenantId).some((d) => d.i === short(id)),
    /** Counts one more failed attempt and returns the new total. */
    bump(tenantId: string, id: string): number {
      const all = attempts(tenantId);
      const n = (all[short(id)] ?? 0) + 1;
      write(tenantId, attemptsKey, { ...all, [short(id)]: n }, false);
      return n;
    },
    /** After a delivery: forgets its attempts and any quarantine entry for the same address (an older version). */
    clear(tenantId: string, id: string, address: string): void {
      const { [short(id)]: gone, ...rest } = attempts(tenantId);
      if (gone !== undefined) write(tenantId, attemptsKey, rest, Object.keys(rest).length === 0);
      const kept = dead(tenantId).filter((d) => d.a !== address);
      if (kept.length !== dead(tenantId).length) write(tenantId, deadKey, kept, kept.length === 0);
    },
    /** Quarantines an event, oldest entries dropped past MAX_DEAD. */
    bury(tenantId: string, id: string, failure: Failure): void {
      const entry = { i: short(id), a: failure.address, e: failure.error.slice(0, MAX_ERROR_CHARS) };
      write(tenantId, deadKey, [...dead(tenantId), entry].slice(-MAX_DEAD), false);
    },
    quarantined: (tenantId: string): Failure[] => dead(tenantId).map((d) => ({ address: d.a, error: d.e })),
  };
}
