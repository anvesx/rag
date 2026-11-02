import type { Pointer } from "@brain/core-types";
import type { Chunk } from "@rag/chunker";
import type { SearchIndex } from "@rag/hybrid-search";
import type { Registry } from "@rag/pointer-registry";

/** Text the caller already fetched. `contentHash` is sha-256 hex of `text` and must equal the pointer's. */
export type Content = { text: string; contentHash: string };

export type ChangeEvent = { type: "upsert"; pointer: Pointer; content?: Content } | { type: "delete"; tenantId: string; id: string; at: string };

export type ApplyResult = {
  outcome: "created" | "updated" | "unchanged" | "deleted" | "absent";
  chunks: number;
};

export type IndexDeps = {
  registry: Registry;
  index: SearchIndex;
  chunk: (docId: string, text: string) => Promise<Chunk[]>;
  embed: (texts: string[]) => Promise<number[][]>;
  /** Optional. Without it every upsert must carry `content`, else `INVALID_EVENT`. */
  fetchText?: (pointer: Pointer) => Promise<string>;
};

export interface IndexService {
  apply(event: ChangeEvent): Promise<ApplyResult>;
}

export type IndexErrorCode =
  | "INVALID_EVENT"
  | "HASH_MISMATCH"
  | "FETCH_FAILED"
  | "CHUNK_FAILED"
  | "EMBED_FAILED"
  | "EMBED_INVALID"
  | "INDEX_FAILED"
  | "ROLLBACK_FAILED";

export class IndexServiceError extends Error {
  readonly code: IndexErrorCode;

  constructor(code: IndexErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "IndexServiceError";
    this.code = code;
  }
}
