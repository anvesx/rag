import type { Pointer } from "@brain/core-types";
import { expect } from "vitest";
import { RegistryError } from "../src/index.js";

/** A valid pointer; override any field. Hash is derived from the seed so rows differ. */
export const ptr = (over: Partial<Pointer> = {}): Pointer => ({
  id: "doc-1",
  tenantId: "t1",
  source: "gdrive",
  address: "https://example.test/doc-1",
  title: "Doc",
  version: "v1",
  contentHash: "a".repeat(64),
  zone: "team",
  acl: { allowUsers: ["u1"], allowGroups: [], version: 1 },
  updatedAt: "2026-11-01T00:00:00Z",
  deletedAt: null,
  ...over,
});

export const hashOf = (n: number): string => n.toString(16).padStart(64, "0");

export const code = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RegistryError);
    return (e as RegistryError).code;
  }
  return "no-throw";
};
