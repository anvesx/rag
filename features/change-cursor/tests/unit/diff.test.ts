import { describe, expect, it } from "vitest";
import { diffListing } from "../../src/diff.js";
import { thrownBy } from "./support.js";

const m = (entries: [string, string][]) => new Map(entries);
const none = { created: [], updated: [], deleted: [] };

describe("diffListing", () => {
  it("reports created, updated and deleted addresses", () => {
    const known = m([["a", "1"], ["b", "1"], ["c", "1"]]);
    const listed = m([["b", "2"], ["c", "1"], ["d", "1"]]);
    expect(diffListing(known, listed)).toEqual({ created: ["d"], updated: ["b"], deleted: ["a"] });
  });

  it("returns three empty lists for identical maps", () => {
    const same = m([["a", "1"], ["b", "2"]]);
    expect(diffListing(same, new Map(same))).toEqual(none);
  });

  it("allows empty maps on either side", () => {
    expect(diffListing(new Map(), new Map())).toEqual(none);
    expect(diffListing(new Map(), m([["x", "1"]])).created).toEqual(["x"]);
    expect(diffListing(m([["x", "1"]]), new Map()).deleted).toEqual(["x"]);
  });

  it("sorts every list", () => {
    expect(diffListing(new Map(), m([["c", "1"], ["a", "1"], ["b", "1"]])).created).toEqual(["a", "b", "c"]);
    expect(diffListing(m([["z", "1"], ["m", "1"]]), new Map()).deleted).toEqual(["m", "z"]);
    const changed = diffListing(m([["c", "1"], ["a", "1"], ["b", "1"]]), m([["c", "2"], ["a", "2"], ["b", "2"]]));
    expect(changed.updated).toEqual(["a", "b", "c"]);
  });

  it("reports a deleted address once and nothing else for it", () => {
    expect(diffListing(m([["gone", "1"]]), new Map())).toEqual({ created: [], updated: [], deleted: ["gone"] });
  });

  it("treats an equal version as unchanged", () => {
    expect(diffListing(m([["a", "v1"]]), m([["a", "v1"]]))).toEqual(none);
  });

  it("handles unicode addresses", () => {
    expect(diffListing(new Map(), m([["文書/ü.md", "v1"]])).created).toEqual(["文書/ü.md"]);
  });

  it.each([[null], [undefined], [[]], [{}], ["text"], [3]])("rejects a non-Map input %j", (bad) => {
    const first = thrownBy(() => diffListing(bad as never, new Map()));
    expect(first.code).toBe("INVALID_INPUT");
    expect(first.message).toContain("known must be a Map");
    const second = thrownBy(() => diffListing(new Map(), bad as never));
    expect(second.message).toContain("listed must be a Map");
  });

  it("rejects a non-string version in either map", () => {
    const known = thrownBy(() => diffListing(new Map([["a", 2 as never]]), new Map()));
    expect(known.code).toBe("INVALID_INPUT");
    expect(known.message).toContain("known has a non-string version");
    const listed = thrownBy(() => diffListing(new Map(), new Map([["a", null as never]])));
    expect(listed.message).toContain("listed has a non-string version");
  });

  it("rejects a non-string address", () => {
    const err = thrownBy(() => diffListing(new Map(), new Map([[1 as never, "v"]])));
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toContain("listed has an empty or non-string address");
  });

  it("rejects an empty address", () => {
    const err = thrownBy(() => diffListing(new Map([["", "v"]]), new Map()));
    expect(err.message).toContain("known has an empty or non-string address");
  });
});
