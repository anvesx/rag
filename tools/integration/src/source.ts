import { type Connector, ConnectorError, type FakeDoc } from "@brain/connector-kit";

export interface Source extends Connector {
  put(doc: FakeDoc): void;
  remove(address: string): void;
  /** While on, `fetch(address)` throws, as a flaky upstream would. */
  failFetch(address: string, on: boolean): void;
  docs(): FakeDoc[];
}

/** A connector whose documents can change between runs. Listing is sorted by address, paged by offset. */
export function createSource(initial: FakeDoc[], id = "fake"): Source {
  const store = new Map(initial.map((d) => [d.address, d]));
  const failing = new Set<string>();
  const sorted = () => [...store.values()].sort((a, b) => a.address.localeCompare(b.address));
  return {
    id,
    async list({ cursor, limit }) {
      const start = cursor === undefined ? 0 : Number(cursor);
      if (!Number.isInteger(start) || start < 0) throw new ConnectorError("BAD_CURSOR", "bad cursor");
      const all = sorted();
      const items = all.slice(start, start + limit).map(({ text: _text, ...meta }) => meta);
      return start + limit < all.length ? { items, nextCursor: String(start + limit) } : { items };
    },
    async fetch(address) {
      const doc = store.get(address);
      if (!doc) throw new ConnectorError("NOT_FOUND", address);
      if (failing.has(address)) throw new Error(`upstream unavailable: ${address}`);
      return { text: doc.text, version: doc.version };
    },
    put: (doc) => void store.set(doc.address, doc),
    remove: (address) => void store.delete(address),
    failFetch: (address, on) => void (on ? failing.add(address) : failing.delete(address)),
    docs: sorted,
  };
}
