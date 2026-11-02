import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkError } from "./errors.js";
import { locate } from "./offsets.js";

export type Chunk = { id: string; docId: string; index: number; text: string; start: number; end: number };
export type ChunkOptions = { size?: number; overlap?: number };

const DEFAULT_SIZE = 1000;
const DEFAULT_OVERLAP = 100;

/** Hard cap on chunks per document. The library spreads its result into `push(...)`, which overflows the stack near 100k. */
export const MAX_CHUNKS = 50_000;

/** Stable chunk id: sha256 of the JSON array [docId, index, text], hex. JSON quoting makes the tuple unambiguous. */
export function chunkId(docId: string, index: number, text: string): string {
  return createHash("sha256")
    .update(JSON.stringify([docId, index, text]), "utf8")
    .digest("hex");
}

const tooMany = () => new ChunkError("TOO_MANY_CHUNKS", `document would produce more than ${MAX_CHUNKS} chunks; raise size or lower overlap`);

/** Splits, turning a stack overflow inside the library into a typed error. */
async function split(splitter: RecursiveCharacterTextSplitter, text: string): Promise<string[]> {
  try {
    return await splitter.splitText(text);
  } catch (err) {
    throw err instanceof RangeError ? tooMany() : err;
  }
}

/** The library splits on "" by UTF-16 unit, which can cut a surrogate pair. Split by code point instead. */
class CodePointSplitter extends RecursiveCharacterTextSplitter {
  protected override splitOnSeparator(text: string, separator: string): string[] {
    return separator === "" ? [...text] : super.splitOnSeparator(text, separator);
  }
}

function resolve(docId: unknown, text: unknown, opt: ChunkOptions): { size: number; overlap: number } {
  const size = opt.size ?? DEFAULT_SIZE;
  const overlap = opt.overlap ?? DEFAULT_OVERLAP;
  if (typeof docId !== "string") throw new ChunkError("BAD_OPTIONS", "docId must be a string");
  if (typeof text !== "string") throw new ChunkError("BAD_OPTIONS", "text must be a string");
  if (!Number.isInteger(size) || size < 1) throw new ChunkError("BAD_OPTIONS", "size must be an integer >= 1");
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size) {
    throw new ChunkError("BAD_OPTIONS", "overlap must be an integer in [0, size)");
  }
  return { size, overlap };
}

/** Splits text into overlapping chunks with stable ids and verified offsets. */
export async function chunkText(docId: string, text: string, opt: ChunkOptions = {}): Promise<Chunk[]> {
  const { size, overlap } = resolve(docId, text, opt);
  if (text.trim() === "") return [];
  if (Math.ceil((text.length - overlap) / (size - overlap)) > MAX_CHUNKS) throw tooMany();
  const splitter = new CodePointSplitter({ chunkSize: size, chunkOverlap: overlap });
  const pieces = await split(splitter, text);
  return locate(text, pieces, overlap).map((hit, index) => ({
    id: chunkId(docId, index, hit.text),
    docId,
    index,
    text: hit.text,
    start: hit.start,
    end: hit.end,
  }));
}
