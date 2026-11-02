export { type EmbedQuery, type Outcome, type OutcomeFn, toOutcomeFn, toSearchFn } from "./adapter.js";
export { auditedOutcome, auditedSearch } from "./audit.js";
export { RetrievalError, type RetrievalErrorCode } from "./errors.js";
export { type ConnectorAclDeps, createConnectorLiveAcl } from "./live/connector-acl.js";
export { createRetrieval, type RetrievalHandle, type RetrievalOptions } from "./retrieval.js";
