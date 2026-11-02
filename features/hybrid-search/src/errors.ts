export type SearchErrorCode = "ACL" | "DB" | "DIM" | "DUPLICATE" | "INPUT" | "LIMIT" | "OFFSET";

export class SearchError extends Error {
  readonly code: SearchErrorCode;

  constructor(code: SearchErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "SearchError";
    this.code = code;
  }
}
