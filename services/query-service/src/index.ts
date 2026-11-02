export { QueryError, type QueryErrorCode } from "./errors.js";
export type { LiveAcl, Timer, Verdict } from "./paging/live.js";
export { DEFAULT_MAX_CANDIDATES } from "./paging/scan.js";
export {
  DEFAULT_LIMIT,
  DEFAULT_LIVE_TIMEOUT_MS,
  type LiveQueryService,
  MAX_LIMIT,
  type PagedIndex,
  type QueryDeps,
  type QueryService,
  type SearchRequest,
  type SearchResult,
  validate,
} from "./request.js";
export { createQueryService } from "./service.js";
