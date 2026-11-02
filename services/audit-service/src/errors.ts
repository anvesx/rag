export type AuditServiceErrorCode = "ANCHOR_STORE" | "CLOCK";

/** Typed failure. ANCHOR_STORE = the anchor store could not be read or written; CLOCK = the injected clock gave an invalid date. */
export class AuditServiceError extends Error {
  readonly code: AuditServiceErrorCode;
  constructor(code: AuditServiceErrorCode, message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "AuditServiceError";
    this.code = code;
  }
}

export class AnchorStoreError extends AuditServiceError {
  constructor(message: string, cause: unknown) {
    super("ANCHOR_STORE", message, { cause });
    this.name = "AnchorStoreError";
  }
}
