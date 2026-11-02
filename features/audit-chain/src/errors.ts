export type AuditErrorCode = "INVALID" | "STORAGE";

/** Typed failure. INVALID = caller bug (bad input); STORAGE = the database refused. */
export class AuditError extends Error {
  readonly code: AuditErrorCode;
  constructor(code: AuditErrorCode, message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "AuditError";
    this.code = code;
  }
}
