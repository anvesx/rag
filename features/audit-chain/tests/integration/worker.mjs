import { parentPort, workerData } from "node:worker_threads";

const { chainJs, dbPath, tenantId, count } = workerData;
const { createAuditChain } = await import(chainJs);
const chain = createAuditChain(dbPath);
const seqs = [];
for (let i = 0; i < count; i++) {
  seqs.push(chain.append({ tenantId, actor: "w", action: "x", target: `d${i}`, at: "2026-01-01T00:00:00Z" }).seq);
}
parentPort.postMessage(seqs);
