import { allowClause, isAllowed } from "@rag/acl-filter";
import { MAX_WINDOW } from "@rag/hybrid-search";
import { QueryError, wrap } from "./errors.js";
import { realTimer, verifyNeeded } from "./paging/live.js";
import { DEFAULT_MAX_CANDIDATES, ids, scan } from "./paging/scan.js";
import { DEFAULT_LIVE_TIMEOUT_MS, type LiveQueryService, type QueryDeps, type SearchRequest, validate } from "./request.js";

export function createQueryService(deps: QueryDeps): LiveQueryService {
  const { index, registry, liveAcl, timer = realTimer } = deps;
  const { maxCandidates = DEFAULT_MAX_CANDIDATES, liveAclTimeoutMs = DEFAULT_LIVE_TIMEOUT_MS } = deps;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > MAX_WINDOW) throw new QueryError("CONFIG");

  function prepare(request: SearchRequest) {
    const { limit, principal, text } = validate(request);
    const acl = allowClause(principal);
    const state = { halted: false };
    const run = scan({
      halt: () => state.halted,
      limit,
      maxCandidates,
      fetch: (offset, size) => index.search({ text, embedding: request.embedding, limit: size, offset, acl }),
      visible(docId) {
        const pointer = registry.get(principal.tenantId, docId);
        // The registry is authoritative: re-check tombstone, tenant and the current ACL.
        if (!pointer || pointer.deletedAt !== null || pointer.tenantId !== principal.tenantId) return undefined;
        return isAllowed(principal, pointer.acl, pointer.tenantId) ? pointer : undefined;
      },
    });
    return { run, principal, limit, state };
  }

  return {
    search(request) {
      if (liveAcl) throw new QueryError("LIVE_ACL");
      const { run } = prepare(request);
      try {
        let step = run.next();
        while (!step.done) step = run.next(ids(step.value));
        return step.value.pointers;
      } catch (error) {
        return wrap(error);
      }
    },
    async searchLive(request) {
      const { run, principal, limit, state } = prepare(request);
      const meta = { liveDenied: 0, liveUnverified: 0 };
      // One deadline for the whole search, not per page; aborting it also cancels the in-flight source reads.
      const deadline = new AbortController();
      const handle = liveAcl && timer.set(() => deadline.abort(), liveAclTimeoutMs);
      let kept = 0;
      try {
        let step = run.next();
        while (!step.done) {
          const check = liveAcl && (await verifyNeeded(liveAcl, deadline.signal, principal, step.value, limit - kept));
          meta.liveDenied += check?.denied ?? 0;
          meta.liveUnverified += check?.unverified ?? 0;
          state.halted = check?.halt ?? false;
          const allowed = check ? check.allowed : ids(step.value);
          kept += allowed.size;
          step = run.next(allowed);
        }
        return { ...step.value, ...meta };
      } catch (error) {
        return wrap(error);
      } finally {
        if (handle !== undefined) timer.clear(handle);
      }
    },
  };
}
