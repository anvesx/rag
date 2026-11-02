import { ConnectorError } from "@anvesx/connector-kit";
import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { createCursorStore } from "@rag/change-cursor";
import { describe, expect, it } from "vitest";
import { createConnectorRuntime } from "../../src/index.js";
import { five, tmpDb } from "../helpers.js";

const make = (list: (q: { cursor?: string; limit: number }) => never | undefined) => {
  const cursors = createCursorStore(tmpDb(), () => 1);
  const connector = createFakeConnector("fake", five);
  const inner = connector.list.bind(connector);
  connector.list = async (q) => {
    list(q);
    return inner(q);
  };
  const events: string[] = [];
  const sink = (e: { address: string }): void => void events.push(e.address);
  const runtime = createConnectorRuntime({ connector, cursors, sink, clock: () => 1, pageSize: 2 });
  return { cursors, runtime, events };
};

describe("connector list errors", () => {
  it("BAD_CURSOR restarts a full scan once and completes", async () => {
    const s = make((q) => {
      if (q.cursor === "stale:2") throw new ConnectorError("BAD_CURSOR", "stale");
    });
    s.cursors.setCursor("t1", "fake", "stale:2");
    expect(await s.runtime.runOnce("t1")).toMatchObject({ emitted: 5, restarted: true });
    expect(s.events).toHaveLength(5);
  });

  it("repeated BAD_CURSOR fails with a typed error", async () => {
    const s = make(() => {
      throw new ConnectorError("BAD_CURSOR", "always");
    });
    await expect(s.runtime.runOnce("t1")).rejects.toMatchObject({
      code: "BAD_CURSOR_LOOP",
      message: "BAD_CURSOR after full restart",
      cause: { code: "BAD_CURSOR" },
    });
  });

  it("propagates non-cursor connector errors unchanged", async () => {
    const s = make(() => {
      throw new ConnectorError("NOT_FOUND", "gone");
    });
    await expect(s.runtime.runOnce("t1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
