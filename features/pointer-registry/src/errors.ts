export type RegistryErrorCode = "INVALID" | "TENANT_REQUIRED";

/** Typed failure. Callers branch on `code`, never on the message. */
export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  constructor(code: RegistryErrorCode, message: string = code) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}
