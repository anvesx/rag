export type RuntimeErrorCode = "INVALID_INPUT" | "BAD_CURSOR_LOOP";

/** Typed error for every failure this runtime raises itself. Connector and store errors pass through. */
export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(code: RuntimeErrorCode, message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "RuntimeError";
    this.code = code;
  }
}
