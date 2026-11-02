import assert from "node:assert/strict";
import { test } from "node:test";
import { start } from "../src/rank-server.mjs";

// A real corpus of 300 docs in a real SQLite file, a real socket.
test("rank-server answers /search with hits and rejects bad input", async () => {
  const port = 18791;
  const stop = await start(300, port);
  try {
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    const ok = await fetch(`${base}/search?q=w0&p=company&k=5`);
    assert.equal(ok.status, 200);
    const { hits } = await ok.json();
    assert.ok(Array.isArray(hits) && hits.length > 0 && hits.length <= 5);
    assert.equal((await fetch(`${base}/search?q=w0&p=company&k=0`)).status, 400);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  } finally {
    await stop();
  }
});
