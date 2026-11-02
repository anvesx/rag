import { SearchError } from "@rag/hybrid-search";

export type QueryErrorCode = "BACKEND" | "CONFIG" | "EMBEDDING" | "EMPTY_QUERY" | "LIMIT" | "LIVE_ACL" | "PRINCIPAL";

export class QueryError extends Error {
  readonly code: QueryErrorCode;

  constructor(code: QueryErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "QueryError";
    this.code = code;
  }
}

/** Rethrow typed errors as-is; a wrong-dimension embedding is EMBEDDING, anything else BACKEND. */
export const wrap = (error: unknown): never => {
  if (error instanceof QueryError) throw error;
  throw new QueryError(error instanceof SearchError && error.code === "DIM" ? "EMBEDDING" : "BACKEND", error);
};
