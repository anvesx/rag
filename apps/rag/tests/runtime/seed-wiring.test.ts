import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { afterAll, describe, expect, it } from "vitest";
import { docs, start } from "../harness.js";

const dir = mkdtempSync(join(tmpdir(), "rag-seed-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const alice = { id: "alice", tenantId: "t1", groups: [] };

describe("registry seed is scoped to the tenant's connector", () => {
  it("documents from another source survive a run under a different connector id", async () => {
    const data = join(dir, "renamed");
    const first = await start({ dataDir: data, cursors: undefined, connectorFor: () => createFakeConnector("fake", docs()) });
    await first.app.ingest("t1");
    await first.app.close();
    const renamed = createFakeConnector("renamed", docs().slice(0, 1));
    const second = await start({ dataDir: data, cursors: undefined, connectorFor: () => renamed });
    expect(await second.app.ingest("t1")).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
    const found = await second.app.search({ query: "needle", principal: alice });
    expect(found.map((p) => p.source).sort()).toEqual(["fake", "fake", "renamed"]);
    await second.app.close();
  });

  it("an empty listing after a restart is refused and logged as a warning", async () => {
    const data = join(dir, "empty");
    const first = await start({ dataDir: data, cursors: undefined, connectorFor: () => createFakeConnector("fake", docs()) });
    await first.app.ingest("t1");
    await first.app.close();
    const lines: Array<[string, unknown]> = [];
    const logger = { error() {}, info() {}, warn: (msg: string, fields?: Record<string, unknown>) => lines.push([msg, fields]) };
    const second = await start({ dataDir: data, cursors: undefined, logger, connectorFor: () => createFakeConnector("fake", []) });
    const counts = await second.app.ingest("t1");
    expect(counts.reapSkipped).toEqual({ reason: "empty-listing", wouldDelete: 3, known: 3 });
    expect(lines).toEqual([["reap skipped", { tenantId: "t1", reason: "empty-listing", wouldDelete: 3, known: 3 }]]);
    expect((await second.app.search({ query: "needle", principal: alice })).length).toBe(2);
    await second.app.close();
  });
});
