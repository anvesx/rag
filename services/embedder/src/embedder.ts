import { pipeline } from "@huggingface/transformers";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIMENSIONS = 384;

/** Matches the `embed` and `embedQuery` fields of the rag app's deps and `IndexDeps.embed`. */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export type EmbedderOptions = {
  /** Texts per model call. Default 32. */
  batchSize?: number;
  /** Per `embed` / `embedQuery` call, model load included. Default 120000 ms. */
  timeoutMs?: number;
  /** Where the model files are cached. Default: the library's own cache. */
  cacheDir?: string;
};

type Extractor = (texts: string[], o: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const l2 = (v: number[]): number[] => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n === 0 ? v : v.map((x) => x / n);
};

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`embedder timed out after ${ms} ms`)), ms);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });

export function createEmbedder(opts: EmbedderOptions = {}): Embedder {
  const batchSize = opts.batchSize ?? 32;
  const timeoutMs = opts.timeoutMs ?? 120000;
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new RangeError("batchSize must be a positive integer");
  let loading: Promise<Extractor> | undefined;
  const load = (): Promise<Extractor> => {
    loading ??= pipeline("feature-extraction", MODEL, opts.cacheDir ? { cache_dir: opts.cacheDir } : {}).then(
      (p) => p as unknown as Extractor,
      (e) => {
        loading = undefined; // allow a retry after a failed download
        throw e;
      },
    );
    return loading;
  };
  const run = async (texts: string[]): Promise<number[][]> => {
    const extract = await load();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const t = await extract(texts.slice(i, i + batchSize), { pooling: "mean", normalize: true });
      for (const row of t.tolist()) out.push(l2(row));
    }
    return out;
  };
  return {
    embed: (texts) => (texts.length === 0 ? Promise.resolve([]) : withTimeout(run(texts), timeoutMs)),
    embedQuery: async (text) => {
      const [v] = await withTimeout(run([text]), timeoutMs);
      return v as number[];
    },
  };
}
