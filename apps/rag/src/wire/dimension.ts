import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RagDeps } from "../types.js";

/** An existing search index was built for a different vector size than the embedder now produces. Never auto-migrated: that would corrupt it. */
export class IndexDimensionError extends Error {
  readonly code = "INDEX_DIMENSION";
  constructor(
    readonly path: string,
    readonly found: number,
    readonly expected: number,
  ) {
    super(`search index ${path} holds ${found}-dimensional vectors but the embedder produces ${expected}; use a fresh RAG_DATA_DIR and re-ingest`);
    this.name = "IndexDimensionError";
  }
}

/** The index's vector size: the given dimension, else measured by embedding one probe text. Fails fast when an existing index in dataDir disagrees. */
export async function resolveDimension(deps: Pick<RagDeps, "dimension" | "embed" | "dataDir">): Promise<number> {
  let dimension = deps.dimension;
  if (dimension === undefined) {
    const [vector] = await deps.embed(["dimension probe"]);
    if (!vector) throw new Error("embed returned no vector for the dimension probe");
    dimension = vector.length;
  }
  if (deps.dataDir) assertIndexDimension(join(deps.dataDir, "search.db"), dimension);
  return dimension;
}

/** Reads the vector size an existing index file was created with (read-only) and throws IndexDimensionError when it differs. A missing file or an index with no vector table passes. */
export function assertIndexDimension(path: string, expected: number): void {
  if (!existsSync(path)) return;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'chunks_vec'").get() as { sql: string } | undefined;
    const found = row === undefined ? undefined : /float\[(\d+)\]/.exec(row.sql)?.[1];
    if (found !== undefined && Number(found) !== expected) throw new IndexDimensionError(path, Number(found), expected);
  } finally {
    db.close();
  }
}
