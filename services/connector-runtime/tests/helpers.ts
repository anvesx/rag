import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Connector, FakeDoc } from "@anvesx/connector-kit";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { createCursorStore } from "@rag/change-cursor";
import { type ChangeEvent, createConnectorRuntime, type Sink } from "../src/index.js";

export const doc = (address: string, version = "v1"): FakeDoc => ({
  address,
  title: address,
  version,
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  zone: "personal",
  updatedAt: "2026-01-01T00:00:00.000Z",
  text: `text of ${address}`,
});

export const tmpDb = (): string => join(mkdtempSync(join(tmpdir(), "cr-")), "c.db");

export const five = ["a", "b", "c", "d", "e"].map((a) => doc(a));

/** Sink that records deliveries, but throws for `address` while `fail()` is true. */
export const failingOn = (address: string, delivered: string[], fail: () => boolean) => (e: { address: string }) => {
  if (e.address === address && fail()) throw new Error("boom");
  delivered.push(e.address);
};

export const firstPageCursor = async (connector: Connector) => (await connector.list({ limit: 2 })).nextCursor;

/** A runtime over the same connector and cursor store as `s`, with its own sink. */
export const withSink = (s: ReturnType<typeof setup>, sink: Sink) =>
  createConnectorRuntime({ connector: s.connector, cursors: s.cursors, clock: () => 1, pageSize: 2, sink });

export const setup = (docs: FakeDoc[], dbPath = tmpDb(), pageSize = 2) => {
  const events: ChangeEvent[] = [];
  const sink = (e: ChangeEvent): void => {
    events.push(e);
  };
  const cursors = createCursorStore(dbPath, () => 1000);
  const connector = createFakeConnector("fake", docs);
  const runtime = createConnectorRuntime({ connector, cursors, sink, clock: () => 1000, pageSize });
  return { events, runtime, cursors, connector, sink, dbPath };
};
