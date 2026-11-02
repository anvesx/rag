import type { Pointer } from "@brain/core-types";
import type { Chunk } from "@rag/chunker";
import { type IndexDeps, type IndexErrorCode, IndexServiceError } from "../types.js";
import { verifyFetched } from "./content.js";

export type Row = { chunk: Chunk; embedding: number[] };
type Deps = Pick<IndexDeps, "chunk" | "embed" | "fetchText">;

async function step<T>(code: IndexErrorCode, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new IndexServiceError(code, error);
  }
}

const isVector = (v: unknown): v is number[] => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "number" && Number.isFinite(x));

function checkEmbeddings(vectors: unknown, count: number): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== count || !vectors.every(isVector)) throw new IndexServiceError("EMBED_INVALID");
  const dim = vectors[0]?.length;
  if (!vectors.every((v) => v.length === dim)) throw new IndexServiceError("EMBED_INVALID");
  return vectors;
}

/** Chunk and embed one document, fetching its text unless the caller already has it. Touches no stored state. */
export async function prepare(deps: Deps, pointer: Pointer, prefetched?: string): Promise<Row[]> {
  const { fetchText } = deps;
  if (prefetched === undefined && !fetchText) throw new IndexServiceError("INVALID_EVENT");
  const text =
    prefetched ??
    (await step("FETCH_FAILED", async () => {
      const t = await (fetchText as NonNullable<typeof fetchText>)(pointer);
      if (typeof t !== "string") throw new TypeError("fetchText must return a string");
      return t;
    }));
  // Prefetched text was verified by the service before any state change; fetched text is verified here.
  if (prefetched === undefined) verifyFetched(pointer, text);
  const chunks = await step("CHUNK_FAILED", () => deps.chunk(pointer.id, text));
  if (chunks.length === 0) return [];
  const raw = await step("EMBED_FAILED", () => deps.embed(chunks.map((c) => c.text)));
  const vectors = checkEmbeddings(raw, chunks.length);
  return chunks.map((chunk, i) => ({ chunk, embedding: vectors[i] as number[] }));
}
