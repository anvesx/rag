import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";
import { readTx, writeTx } from "../../../src/store/tx.js";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("transaction errors", () => {
  const caught = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (e) {
      return e;
    }
    return undefined;
  };
  const endThenThrow = (end: () => void, e: Error): never => {
    end();
    throw e;
  };
  const ended = () => {
    const dir = mkdtempSync(join(tmpdir(), "rank-tx-"));
    dirs.push(dir);
    const db = new DatabaseSync(join(dir, "t.sqlite"));
    return { db, end: () => db.exec("ROLLBACK") };
  };
  it("writeTx rethrows the original error when ROLLBACK itself fails", () => {
    const { db, end } = ended();
    const boom = new Error("boom");
    expect(caught(() => writeTx(db, () => endThenThrow(end, boom)))).toBe(boom);
  });
  it("writeTx reports a failed COMMIT, not the ROLLBACK that follows it", () => {
    const { db, end } = ended();
    expect(String(caught(() => writeTx(db, end)))).toMatch(/commit/i);
  });
  it("readTx rethrows the original error when COMMIT fails", () => {
    const { db, end } = ended();
    const boom = new Error("boom");
    expect(caught(() => readTx(db, () => endThenThrow(end, boom)))).toBe(boom);
  });
});
