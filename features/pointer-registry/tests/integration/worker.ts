import { createRegistry } from "../../src/index.js";
import { hashOf, ptr } from "../fixtures.js";

/** Child process: argv = dbFile, workerIndex, startAtEpochMs, rounds. Prints change counts as JSON. */
const [file = "", k = "0", startAt = "0", rounds = "0"] = process.argv.slice(2);
const r = createRegistry(file);
const counts = { created: 0, updated: 0, unchanged: 0 };
while (Date.now() < Number(startAt)) {} // barrier: all workers start hammering together
for (let i = 0; i < Number(rounds); i++) {
  // Few distinct hashes, so the same key sees all of created/updated/unchanged from every process.
  counts[r.upsert(ptr({ contentHash: hashOf((Number(k) + i) % 5) })).change]++;
  r.upsert(ptr({ id: `own-${k}-${i}`, contentHash: hashOf(i) }));
}
r.close();
console.log(JSON.stringify(counts));
