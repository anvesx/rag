/** Thrown by `reindex` before any work when the asking user's token is missing, not a string, or blank. */
export class TokenRequiredError extends Error {
  readonly code = "TOKEN_REQUIRED";
  constructor() {
    super("reindex needs the asking user's token: got none, an empty string or only whitespace");
    this.name = "TokenRequiredError";
  }
}

/** Fails closed: JS callers can pass anything, so the `string` type alone proves nothing at runtime. */
export function assertToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || token.trim() === "") throw new TokenRequiredError();
}
