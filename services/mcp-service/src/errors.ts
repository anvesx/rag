export type McpServiceErrorCode = "INVALID_CONFIG" | "UNAUTHENTICATED" | "FORBIDDEN" | "BAD_JSON" | "BODY_TOO_LARGE" | "TOO_MANY_SESSIONS";

/** Every failure this service raises on purpose; anything else is a bug and maps to a generic 500. */
export class McpServiceError extends Error {
  constructor(
    readonly code: McpServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "McpServiceError";
  }
}
