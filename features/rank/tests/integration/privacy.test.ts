import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { doc } from "../support/docs.js";
import { useTmpFile } from "../support/tmpfile.js";

const asker = { principals: ["hr"] };
const { file, open } = useTmpFile();
const WORDS = "salary for zebra cornucopia is confidential quarterly payroll hr p".split(" ");
const original = doc("d1", { title: "Quarterly payroll", path: "/hr/p", body: "salary for zebra cornucopia is confidential", principals: ["hr"] });

type Row = { term: string; doc: number; col: string; tf: number };
const dump = (): { rows: Row[]; tables: { name: string; cols: string[] }[] } => {
  const db = new DatabaseSync(file(), { readOnly: true });
  const col = (sql: string) => (db.prepare(sql).all() as { name: string }[]).map((r) => r.name);
  const tables = col("select name from sqlite_master where type = 'table'").map((name) => ({
    name,
    cols: col(`select name from pragma_table_info('${name}')`),
  }));
  const rows = db.prepare("select term, doc, col, tf from postings order by doc, col, term").all() as Row[];
  db.close();
  return { rows, tables };
};

describe("what the file lets a reader recover", () => {
  it("has no positional table, so word order cannot be rebuilt", () => {
    const ix = open();
    ix.index([original]);
    ix.close();
    const { tables } = dump();
    const cols = tables.flatMap((t) => t.cols);
    expect(tables.map((t) => t.name).filter((n) => /fts|vocab/.test(n))).toEqual([]);
    expect(cols.filter((c) => /off|pos|ord|seq/.test(c))).toEqual([]);
  });
  it("stores identical rows for the same words in a different order", () => {
    const rows = (body: string) => {
      const ix = open();
      ix.index([doc("x", { body, principals: ["hr"] })]);
      ix.close();
      return dump().rows.map(({ term, col, tf }) => [term, col, tf]);
    };
    const first = rows("alpha beta gamma beta");
    expect(first).toHaveLength(4);
    expect(rows("beta gamma beta alpha")).toEqual(first);
  });
  it("stores terms that are neither hex, plain hashes nor decodable to a word of the text", () => {
    const ix = open();
    ix.index([original]);
    ix.close();
    const { rows } = dump();
    expect(rows.length).toBeGreaterThan(0);
    const sha = (w: string) => createHash("sha256").update(w).digest("hex");
    const bare = new Set(WORDS.flatMap((w) => [Buffer.from(w).toString("hex"), sha(w), sha(w).slice(0, 32)]));
    for (const { term } of rows) {
      expect(bare.has(term)).toBe(false);
      expect(WORDS).not.toContain(Buffer.from(term, "hex").toString("utf8"));
    }
  });
  it("uses different terms under a different key, and a wrong key finds nothing", () => {
    const [ka, kb] = ["a".repeat(32), "b".repeat(32)];
    const a = open(ka);
    a.index([original]);
    a.close();
    const termsA = dump().rows.map((r) => r.term);
    const b = open(kb);
    expect(b.search({ query: "zebra", asker })).toEqual([]);
    b.index([{ ...original, id: "d2" }]);
    b.close();
    const termsB = dump()
      .rows.filter((r) => r.doc === 2)
      .map((r) => r.term);
    expect(termsB).toHaveLength(termsA.length);
    expect(termsB.filter((t) => termsA.includes(t))).toEqual([]);
    const again = open(ka);
    expect(again.search({ query: "zebra", asker }).map((h) => h.id)).toEqual(["d1"]);
    again.close();
  });
});
