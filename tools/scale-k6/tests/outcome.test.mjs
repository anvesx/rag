import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { exitCode, reportPath } from "../bin/outcome.mjs";

const run = (code) => spawnSync(process.execPath, ["-e", code]);

test("a process that exits 0 passes and its own non-zero status is kept", () => {
  assert.equal(exitCode(run("process.exit(0)")), 0);
  assert.equal(exitCode(run("process.exit(99)")), 99);
});

test("a process killed by a signal has a null status and still fails", () => {
  const killed = run("process.kill(process.pid, 'SIGKILL')");
  assert.equal(killed.status, null);
  assert.equal(killed.signal, "SIGKILL");
  assert.notEqual(exitCode(killed), 0);
});

test("a binary that cannot be started fails", () => {
  const missing = spawnSync("k6-does-not-exist-here", ["run"]);
  assert.notEqual(exitCode(missing), 0);
});

test("the summary export is kept under reports/, not in the removed temp dir", () => {
  const path = reportPath("rank");
  assert.match(path, /scale-k6\/reports\/rank\.json$/);
  assert.equal(path.startsWith(tmpdir()), false);
});
