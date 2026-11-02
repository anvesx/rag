import fc from "fast-check";
import { afterAll } from "vitest";
import { type Doc, type Hit, RankIndex, type SearchRequest } from "../../src/index.js";
import { NOW } from "./oracle.js";

export const doc = (id: string, over: Partial<Doc> = {}): Doc => ({
  id,
  title: "",
  path: `/${id}`,
  body: "",
  principals: ["company"],
  mtimeMs: NOW,
  links: [],
  ...over,
});

/** A fixed test key. Production keys must be random and secret. */
export const KEY = "rank-test-key-0123456789abcdef";

const opened: RankIndex[] = [];
afterAll(() => {
  for (const ix of opened.splice(0)) ix.close();
});

/** An in-memory index with a fixed clock, closed when the test file ends. Use `use` inside property loops. */
export const open = (key: string = KEY): RankIndex => {
  const ix = RankIndex.open(":memory:", { key, now: () => NOW });
  opened.push(ix);
  return ix;
};

/** Open, run, close at once, so a property that runs hundreds of times holds one handle at a time. */
export const use = <T>(fn: (ix: RankIndex) => T): T => {
  const ix = RankIndex.open(":memory:", { key: KEY, now: () => NOW });
  try {
    return fn(ix);
  } finally {
    ix.close();
  }
};

/** Index `all` in a throwaway index and answer one request. */
export const indexed = (all: Doc[], req: SearchRequest): Hit[] =>
  use((ix) => {
    ix.index(all);
    return ix.search(req);
  });

export const PRINCIPALS = ["u:ana", "u:bo", "t:eng", "t:ops", "company"];
const WORDS = ["alpha", "beta", "gamma", "deploy", "payroll", "naïve", "日本語", "Привет", "x"];
const text = fc.array(fc.constantFrom(...WORDS), { maxLength: 6 }).map((w) => w.join(" "));

export const docArb: fc.Arbitrary<Doc> = fc.record({
  id: fc.constantFrom("d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"),
  title: text,
  path: fc.array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 3 }).map((w) => `/${w.join("/")}`),
  body: text,
  principals: fc.subarray(PRINCIPALS, { maxLength: 3 }),
  mtimeMs: fc.integer({ min: 0, max: 4 }).map((d) => NOW - d * 86_400_000 * 30),
  links: fc.subarray(["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"], { maxLength: 3 }),
});

export const askerArb = fc.subarray(PRINCIPALS, { minLength: 1 });
export const queryArb = fc.array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 3 }).map((w) => w.join(" "));
