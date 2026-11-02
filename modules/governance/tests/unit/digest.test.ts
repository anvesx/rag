import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGovernance, GovernanceError } from "../../src/index.js";
import { alice, auditKey, fakes, req } from "./helpers.js";

const targets = async (key: string | Uint8Array, ...reqs: ReturnType<typeof req>[]) => {
  const f = fakes();
  const gov = createGovernance({ audit: f.audit, query: f.query, auditKey: key });
  for (const r of reqs) await gov.search(r);
  return f.calls.map((c) => c.event.target);
};

describe("keyed audit digest", () => {
  it("same query and tenant give the same digest", async () => {
    const [a, b] = await targets(auditKey, req("roadmap"), req("roadmap"));
    expect(a).toBe(b);
  });
  it("different tenant gives a different digest for the same query", async () => {
    const [a, b] = await targets(auditKey, req("roadmap"), req("roadmap", { ...alice, tenantId: "t2" }));
    expect(a).not.toBe(b);
  });
  it("different master key gives a different digest", async () => {
    const [a] = await targets("key-one", req("roadmap"));
    const [b] = await targets("key-two", req("roadmap"));
    expect(a).not.toBe(b);
  });
  it("is not the unsalted sha256, so a dictionary of plain hashes finds nothing", async () => {
    const [a] = await targets(auditKey, req("roadmap"));
    expect(a).not.toBe(createHash("sha256").update("roadmap").digest("hex"));
  });
  it("trims surrounding whitespace before digesting", async () => {
    const [a, b] = await targets(auditKey, req("roadmap"), req("  roadmap \n"));
    expect(a).toBe(b);
  });
  it("stores no raw query text anywhere in the audit row", async () => {
    const f = fakes();
    await f.gov.search(req("quarterly layoffs plan"));
    const row = JSON.stringify(f.calls);
    for (const word of ["quarterly", "layoffs", "plan"]) expect(row).not.toContain(word);
  });
  it("accepts a binary key", async () => {
    const [a] = await targets(new Uint8Array([1, 2, 3]), req("q"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each([undefined, "", new Uint8Array()])("refuses to construct without a key (%s)", (key) => {
    const f = fakes();
    const make = () => createGovernance({ audit: f.audit, query: f.query, auditKey: key as never });
    expect(make).toThrow(GovernanceError);
    expect(make).toThrow(expect.objectContaining({ code: "CONFIG", message: "auditKey is required" }));
  });
});
