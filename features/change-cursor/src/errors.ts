/** Why a call was refused. Storage failures are not wrapped; they propagate unchanged. */
export type CursorErrorCode = "INVALID_INPUT" | "CURSOR_TOO_LARGE";

/** Typed error for every rule this package enforces on its inputs. */
export class CursorError extends Error {
  readonly code: CursorErrorCode;

  constructor(code: CursorErrorCode, message: string) {
    super(message);
    this.name = "CursorError";
    this.code = code;
  }
}
