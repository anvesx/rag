import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { GENESIS, hashEvent } from "../../src/canonical.js";
import { type AuditEvent, createAuditChain } from "../../src/chain.js";
import { rawTamperDb } from "../helpers.js";

const dir = mkdtempSync(join(tmpdir(), "audit-prop-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const path = join(dir, "p.db");
const chain = createAuditChain(path);
const raw = rawTamperDb(path); // drops triggers: later opens would reinstall, so open the chain first
let run = 0;

const str = fc.string({ unit: "grapheme", minLength: 1, maxLength: 40 }).filter((x) => !x.includes("\u0000"));
const iso = fc.date({ min: new Date("2000-01-01"), max: new Date("2100-01-01"), noInvalidDate: true }).map((d) => d.toISOString());
const detail = fc.dictionary(str, fc.jsonValue(), { maxKeys: 4 });
const event = (tenantId: string) =>
  fc.tuple(str, str, str, iso, fc.option(detail, { nil: undefined })).map(
    ([actor, action, target, at, d]): AuditEvent => ({
      tenantId,
      actor,
      action,
      target,
      at,
      ...(d ? { detail: d } : {}),
    }),
  );

describe("properties", () => {
  it("random event sequences always verify ok and list back what was appended", () => {
    fc.assert(
      fc.property(fc.array(event("x"), { maxLength: 8 }), (evs) => {
        const tenant = `ok-${run++}`;
        for (const e of evs) chain.append({ ...e, tenantId: tenant });
        expect(chain.verify(tenant)).toEqual({ ok: true });
        const back = chain.list(tenant).map(({ seq: _s, hash: _h, ...e }) => e);
        expect(back).toEqual(evs.map((e) => ({ ...JSON.parse(JSON.stringify(e)), tenantId: tenant })));
      }),
      { numRuns: 30 },
    );
  });

  it("flipping any character of any stored field breaks verification at that row", () => {
    const fields = ["actor", "action", "target", "at", "hash", "detail"] as const;
    fc.assert(
      fc.property(fc.array(event("x"), { minLength: 1, maxLength: 6 }), fc.nat(), fc.constantFrom(...fields), fc.nat(), (evs, rowPick, field, charPick) => {
        const tenant = `flip-${run++}`;
        for (const e of evs) chain.append({ ...e, tenantId: tenant });
        const seq = (rowPick % evs.length) + 1;
        const cur = (raw.prepare(`SELECT ${field} AS v FROM audit WHERE tenant_id = ? AND seq = ?`).get(tenant, seq) as { v: string | null }).v;
        fc.pre(cur !== null); // detail is NULL when the event had none
        const i = charPick % cur.length;
        const flipped = cur.slice(0, i) + (cur[i] === "a" ? "b" : "a") + cur.slice(i + 1);
        raw.prepare(`UPDATE audit SET ${field} = ? WHERE tenant_id = ? AND seq = ?`).run(flipped, tenant, seq);
        expect(chain.verify(tenant)).toEqual({ ok: false, brokenAt: seq });
      }),
      { numRuns: 60 },
    );
  });

  it("detail key order never changes the hash", () => {
    fc.assert(
      fc.property(fc.dictionary(str, fc.jsonValue(), { minKeys: 1, maxKeys: 5 }), (d) => {
        const rev = Object.fromEntries(Object.entries(d).reverse());
        const base = { tenantId: "t", actor: "a", action: "b", target: "c", at: "2026-01-01T00:00:00Z" };
        expect(hashEvent(GENESIS, { ...base, detail: d })).toBe(hashEvent(GENESIS, { ...base, detail: rev }));
      }),
      { numRuns: 40 },
    );
  });
});
