import { describe, expect, it } from "vitest";
import { GovernanceError } from "../../src/index.js";
import { alice, fakes, ptr, req, targetFor } from "./helpers.js";

describe("governed search", () => {
  it("returns the query results and records exactly one audit row", async () => {
    const { gov, calls } = fakes();
    const out = await gov.search(req());
    expect(out.map((p) => p.id)).toEqual(["d1", "d2"]);
    expect(calls).toHaveLength(1);
  });
  it("records actor, action, keyed target, result count under the principal tenant", async () => {
    const { gov, calls } = fakes();
    await gov.search(req("  secret roadmap  "));
    const target = targetFor("t1", "secret roadmap");
    expect(calls[0]).toEqual({ tenantId: "t1", event: { actor: "alice", action: "search", target, detail: { count: 2 } } });
  });
  it("never stores the raw query text", async () => {
    const { gov, calls } = fakes();
    await gov.search(req("secret roadmap"));
    expect(JSON.stringify(calls)).not.toContain("secret");
  });
  it("counts zero results and still audits", async () => {
    const { gov, calls } = fakes([]);
    expect(await gov.search(req())).toEqual([]);
    expect(calls[0]?.event.detail).toEqual({ count: 0 });
  });
  it("same query hashes the same, different query differs", async () => {
    const { gov, calls } = fakes([ptr("d1")]);
    await gov.search(req("a"));
    await gov.search(req("a"));
    await gov.search(req("b"));
    expect(calls[0]?.event.target).toBe(calls[1]?.event.target);
    expect(calls[2]?.event.target).not.toBe(calls[0]?.event.target);
  });
  it("audits after the search, before returning", async () => {
    const f = fakes();
    await f.gov.search(req());
    expect(f.order).toEqual(["search", "record"]);
  });
  it("fails closed: audit failure returns no results and throws GovernanceError AUDIT with cause", async () => {
    const f = fakes();
    const boom = new Error("disk full");
    f.audit.failWith = boom;
    const e = await f.gov.search(req()).catch((x) => x);
    expect(e).toBeInstanceOf(GovernanceError);
    expect(e).toMatchObject({ code: "AUDIT", cause: boom, name: "GovernanceError", message: "audit record failed" });
  });
  it("passes query errors through untouched and writes no audit row", async () => {
    const f = fakes();
    const bad = new Error("EMPTY_QUERY");
    f.query.throwWith = bad;
    await expect(f.gov.search(req(""))).rejects.toBe(bad);
    expect(f.calls).toHaveLength(0);
  });
  it("uses the principal id as actor for different users", async () => {
    const { gov, calls } = fakes();
    await gov.search(req("q", { ...alice, id: "bob", tenantId: "t9" }));
    expect(calls[0]).toMatchObject({ tenantId: "t9", event: { actor: "bob" } });
  });
  it("digests unicode queries by their utf-8 bytes", async () => {
    const { gov, calls } = fakes();
    await gov.search(req("日本語"));
    expect(calls[0]?.event.target).toBe(targetFor("t1", "日本語"));
  });
});
