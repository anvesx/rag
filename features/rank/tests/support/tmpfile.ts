import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { RankIndex } from "../../src/index.js";
import { KEY } from "./docs.js";
import { NOW } from "./oracle.js";

/** Registers hooks that give each test a fresh real SQLite file path. Returns an `open` bound to that file. */
export const useTmpFile = (): { file: () => string; open: (key?: string) => RankIndex } => {
  let dir = "";
  let file = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rank-it-"));
    file = join(dir, "rank.sqlite");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  return { file: () => file, open: (key = KEY) => RankIndex.open(file, { key, now: () => NOW }) };
};
