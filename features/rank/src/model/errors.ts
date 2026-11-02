export type RankErrorCode = "BAD_DOC" | "BAD_ASKER" | "BAD_QUERY" | "BAD_OPTIONS" | "BAD_INDEX" | "CLOSED";

export class RankError extends Error {
  readonly code: RankErrorCode;

  constructor(code: RankErrorCode, message: string) {
    super(message);
    this.name = "RankError";
    this.code = code;
  }
}
