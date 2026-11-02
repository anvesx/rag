import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { afterAll, describe, expect, it } from "vitest";
import { docs, start } from "../harness.js";

const dir = mkdtempSync(join(tmpdir(), "rag-data-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const alice = { id: "alice", tenantId: "t1", groups: [] };

describe("dataDir persistence", () => {
  it("previously ingested docs are searchable after a restart and are not re-emitted", async () => {
    const data = join(dir, "restart");
    const first = await start({ dataDir: data, cursors: undefined });
    expect(await first.app.ingest("t1")).toMatchObject({ emitted: 3, indexed: 3 });
    await first.app.close();
    const second = await start({ dataDir: data, cursors: undefined });
    const found = await second.app.search({ query: "needle", principal: alice });
    expect(found.map((p) => p.address).sort()).toEqual(["a", "b"]);
    expect(await second.app.ingest("t1")).toMatchObject({ emitted: 0, indexed: 0, failed: 0 });
    await second.app.close();
  });

  it("without dataDir nothing survives a restart", async () => {
    const first = await start();
    await first.app.ingest("t1");
    await first.app.close();
    const second = await start();
    expect(await second.app.search({ query: "needle", principal: alice })).toEqual([]);
    await second.app.close();
  });

  it("docs deleted at source while down are tombstoned on the next run", async () => {
    const data = join(dir, "deleted-while-down");
    const source = createFakeConnector("fake", docs());
    const first = await start({ dataDir: data, cursors: undefined, connectorFor: () => source });
    await first.app.ingest("t1");
    await first.app.close();
    // "a" is deleted at the source while the app is down.
    const shrunk = createFakeConnector(
      "fake",
      docs().filter((d) => d.address !== "a"),
    );
    const second = await start({ dataDir: data, cursors: undefined, connectorFor: () => shrunk });
    expect(await second.app.ingest("t1")).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
    const found = await second.app.search({ query: "needle", principal: alice });
    expect(found.map((p) => p.address)).toEqual(["b"]);
    await second.app.close();
  });
});
