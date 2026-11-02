import { createFakeConnector } from "@brain/connector-kit/testing";
import { describe, expect, it } from "vitest";
import { watchListing } from "../../src/pipeline/listing.js";
import { doc } from "../support/harness.js";

const make = () => {
  const inner = createFakeConnector("fake", [doc("a"), doc("b"), doc("c")]);
  return { inner, ...watchListing(inner) };
};

describe("watchListing", () => {
  it("keeps the connector id and passes fetch through with its arguments", async () => {
    const { watched } = make();
    expect(watched.id).toBe("fake");
    const direct = await watched.fetch("a", { token: "t" });
    expect(direct.text).toBe("text of a");
  });

  it("has seen nothing before any list call", () => {
    const { sawEverything, listed } = make();
    expect(sawEverything()).toBe(false);
    expect(listed.size).toBe(0);
  });

  it("records listed items and proves a full listing only on the last page of a run from the start", async () => {
    const { watched, listed, sawEverything } = make();
    const first = await watched.list({ limit: 2 });
    expect([...listed.keys()]).toEqual(["a", "b"]);
    expect(sawEverything()).toBe(false);
    await watched.list({ limit: 2, cursor: first.nextCursor! });
    expect([...listed.keys()]).toEqual(["a", "b", "c"]);
    expect(sawEverything()).toBe(true);
  });

  it("a run resumed from a saved cursor never proves a full listing", async () => {
    const { watched, inner, sawEverything } = make();
    const first = await inner.list({ limit: 2 });
    await watched.list({ limit: 2, cursor: first.nextCursor! });
    expect(sawEverything()).toBe(false);
  });

  it("starting over from the first page forgets earlier items and completeness", async () => {
    const { watched, listed, sawEverything } = make();
    await watched.list({ limit: 5 });
    expect(sawEverything()).toBe(true);
    await watched.list({ limit: 1 });
    expect(sawEverything()).toBe(false);
    expect([...listed.keys()]).toEqual(["a"]);
  });
});
