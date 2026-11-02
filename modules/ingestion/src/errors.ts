export type IngestionErrorCode = "UNKNOWN_TENANT";

/** Raised by ingestion itself. Runtime, connector and index errors pass through unchanged. */
export class IngestionError extends Error {
  readonly code: IngestionErrorCode;

  constructor(code: IngestionErrorCode, message: string) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
  }
}
