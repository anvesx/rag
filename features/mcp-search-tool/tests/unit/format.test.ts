import type { Pointer } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { formatResults } from "../../src/format.js";

const pointer: Pointer = {
  id: "p-1",
  tenantId: "tenant-1",
  source: "drive",
  address: "drive://doc/1",
  title: "Plan",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: [], allowGroups: [], version: 1 },
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

describe("formatResults", () => {
  it("emits exactly the six public fields, in order", () => {
    const parsed = JSON.parse(formatResults([pointer]));
    expect(Object.keys(parsed)).toEqual(["results"]);
    expect(Object.keys(parsed.results[0])).toEqual(["id", "source", "address", "title", "version", "zone"]);
  });

  it("rejects a pointer carrying a smuggled body field", () => {
    const smuggled = { ...pointer, body: "secret text" } as Pointer;
    expect(() => formatResults([smuggled])).toThrow();
  });

  it("formats an empty list", () => {
    expect(formatResults([])).toBe('{"results":[]}');
  });

  it("throws on a malformed pointer", () => {
    expect(() => formatResults([{ id: "x" } as unknown as Pointer])).toThrow();
  });
});
