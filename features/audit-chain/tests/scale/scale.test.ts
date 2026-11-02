import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { createAuditChain } from "../../src/chain.js";

const dir = mkdtempSync(join(tmpdir(), "audit-scale-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

it("50k appends verify in under 5 s", () => {
  const c = createAuditChain(join(dir, "s.db"));
  const t0 = performance.now();
  for (let i = 0; i < 50_000; i++) c.append({ tenantId: "t", actor: "a", action: "x", target: `d${i}`, at: "2026-01-01T00:00:00Z", detail: { i } });
  const appendMs = performance.now() - t0;
  const t1 = performance.now();
  expect(c.verify("t")).toEqual({ ok: true });
  const verifyMs = performance.now() - t1;
  console.log(`50k appends ${appendMs.toFixed(0)} ms, verify ${verifyMs.toFixed(0)} ms`);
  expect(verifyMs).toBeLessThan(5000);
}, 300_000);
