// A thin HTTP face on RankIndex so k6 can drive it. Dev tool only; the library has no server of its own.
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RankIndex } from "../../../features/rank/dist/index.js";
import { makeDocs } from "../../../features/rank/scripts/bench/corpus.mjs";

export const NOW = Date.UTC(2026, 10, 2);

/** `GET /search?q=w1+w2&p=company,group:3&k=10` answers `{hits}`; `GET /healthz` answers 200. */
export const handler = (ix) => (req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
  if (u.pathname === "/healthz") return send(200, { ok: true });
  if (u.pathname !== "/search") return send(404, { error: "not found" });
  try {
    const principals = (u.searchParams.get("p") ?? "").split(",").filter(Boolean);
    const query = u.searchParams.get("q") ?? "";
    send(200, { hits: ix.search({ query, asker: { principals }, k: Number(u.searchParams.get("k") ?? 10) }) });
  } catch (e) {
    send(400, { error: e.message });
  }
};

/** Builds the seeded corpus in a fresh SQLite file, then listens on loopback. Returns the stop function. */
export const start = async (size, port) => {
  const dir = mkdtempSync(join(tmpdir(), "scale-rank-"));
  const file = join(dir, "rank.sqlite");
  const key = randomBytes(32);
  const seed = RankIndex.open(file, { key, now: () => NOW });
  const docs = makeDocs(size, NOW);
  for (let i = 0; i < docs.length; i += 500) seed.index(docs.slice(i, i + 500));
  seed.close();
  const ix = RankIndex.open(file, { key, now: () => NOW });
  const srv = createServer(handler(ix));
  await new Promise((ok) => srv.listen(port, "127.0.0.1", ok));
  return () =>
    new Promise((ok) =>
      srv.close(() => {
        ix.close();
        rmSync(dir, { recursive: true, force: true });
        ok();
      }),
    );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [size, port] = process.argv.slice(2).map(Number);
  const stop = await start(size, port);
  console.log(`rank-server ${size} docs on 127.0.0.1:${port}`);
  process.on("SIGTERM", () => stop().then(() => process.exit(0)));
}
