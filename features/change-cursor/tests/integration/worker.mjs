import { parentPort, workerData } from "node:worker_threads";

// Each worker opens its own handle on the shared file, waits at a barrier so all workers start together,
// then calls seen() on the same ids. It reports the ids it saw as new.
const { storeJs, dbPath, tenantId, count, gate } = workerData;
const { createCursorStore } = await import(storeJs);
const store = createCursorStore(dbPath, () => 0);
const flags = new Int32Array(gate);
Atomics.add(flags, 0, 1);
Atomics.notify(flags, 0);
Atomics.wait(flags, 1, 0);
const fresh = [];
for (let i = 0; i < count; i++) if (!store.seen(tenantId, `evt-${i}`)) fresh.push(i);
parentPort.postMessage(fresh);
