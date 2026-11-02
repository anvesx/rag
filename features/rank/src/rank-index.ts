import type { DatabaseSync } from "node:sqlite";
import { RankError } from "./model/errors.js";
import type { Cols, Doc, Hit, OpenOptions, Probe, SearchRequest } from "./model/types.js";
import { validateDocs, validateIds, validateKey, validateRequest, validateWeights } from "./model/validate.js";
import { rankSearch } from "./rank-search.js";
import { openDb } from "./store/schema.js";
import { removeDocs, upsertDocs } from "./store/write.js";
import { WEIGHTS } from "./text/formula.js";
import { type Keyer, termKeyer } from "./text/keyed.js";

type Settings = { term: Keyer; now: () => number; weights: Cols };

/** A pointer index over one SQLite file. Synchronous: each call is one transaction. */
export class RankIndex {
  private db: DatabaseSync | null;
  private readonly cfg: Settings;

  private constructor(db: DatabaseSync, cfg: Settings) {
    this.db = db;
    this.cfg = cfg;
  }

  /** `opts.key` is required and is never stored. Options are checked before the file is touched. */
  static open(file: string, opts: OpenOptions): RankIndex {
    const key = validateKey(opts?.key);
    const weights = opts.weights === undefined ? WEIGHTS : validateWeights(opts.weights);
    return new RankIndex(openDb(file), { term: termKeyer(key), now: opts.now ?? Date.now, weights });
  }

  index(docs: readonly Doc[]): { indexed: number } {
    const db = this.handle();
    return { indexed: upsertDocs(db, validateDocs(docs), this.cfg.term) };
  }

  remove(ids: readonly string[]): { removed: number } {
    const db = this.handle();
    return { removed: removeDocs(db, validateIds(ids)) };
  }

  search(req: SearchRequest, probe?: Probe): Hit[] {
    const db = this.handle();
    const { query, principals, k } = validateRequest(req);
    return rankSearch(db, query, { principals, k, now: this.cfg.now(), weights: this.cfg.weights, term: this.cfg.term, probe });
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  private handle(): DatabaseSync {
    if (!this.db) throw new RankError("CLOSED", "index is closed");
    return this.db;
  }
}
