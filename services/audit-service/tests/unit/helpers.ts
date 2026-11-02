import { type AuditChain, createAuditChain } from "@rag/audit-chain";
import { type AnchorRecord, type AnchorStore, createAuditService } from "../../src/index.js";

export const memStore = (): AnchorStore & { rows: AnchorRecord[] } => {
  const rows: AnchorRecord[] = [];
  return {
    rows,
    async append(r) {
      rows.push(r);
    },
    async latest(t) {
      return rows.filter((r) => r.tenantId === t).at(-1);
    },
  };
};
export const clock = () => new Date("2026-02-03T04:05:06.000Z");
export const ev = (n = 1) => ({ actor: "alice", action: "doc.read", target: `doc/${n}`, detail: { n } });
export const make = (chain: AuditChain = createAuditChain(":memory:"), store = memStore()) => ({
  chain,
  store,
  svc: createAuditService({ chain, anchorStore: store, clock }),
});
