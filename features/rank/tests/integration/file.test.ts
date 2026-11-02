import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { doc } from "../support/docs.js";
import { codeOf } from "../support/errors.js";
import { oracle } from "../support/oracle.js";
import { useTmpFile } from "../support/tmpfile.js";

const asker = { principals: ["company"] };
const { file, open } = useTmpFile();

describe("real sqlite file", () => {
  it("persists across close and reopen", () => {
    const a = open();
    a.index([doc("a", { title: "alpha", path: "/p/a" })]);
    a.close();
    const b = open();
    expect(b.search({ query: "alpha", asker }).map((h) => [h.id, h.path])).toEqual([["a", "/p/a"]]);
    b.close();
  });
  it("stores no body or title text, only postings, pointers and ACL rows", () => {
    const ix = open();
    ix.index([doc("a", { title: "zebratitle", body: "zebracornucopia quokka", path: "/p/a", principals: ["u:ana"] })]);
    ix.close();
    const raw = readFileSync(file()).toString("latin1");
    expect(raw).not.toContain("zebracornucopia");
    expect(raw).not.toContain("zebratitle");
    for (const w of ["zebracornucopia", "zebratitle", "quokka"]) expect(raw).not.toContain(Buffer.from(w).toString("hex"));
    expect(raw).toContain("/p/a");
    const db = new DatabaseSync(file(), { readOnly: true });
    const cols = db
      .prepare("select name from pragma_table_info('docs')")
      .all()
      .map((r) => r.name);
    expect(cols).toEqual(["n", "id", "path", "mtime", "lt", "lp", "lb"]);
    const names = db
      .prepare("select name from sqlite_master")
      .all()
      .map((r) => String(r.name));
    expect(names.filter((n) => /fts|vocab/.test(n))).toEqual([]);
    db.close();
  });
  it("matches the oracle on a few hundred docs, through the file", () => {
    const all = Array.from({ length: 300 }, (_, i) =>
      doc(`d${i}`, {
        title: `topic${i % 7} item`,
        body: `body${i % 13} topic${i % 5}`,
        principals: [i % 3 === 0 ? "u:ana" : "company"],
        links: [`d${(i + 1) % 300}`],
      }),
    );
    const ix = open();
    ix.index(all);
    for (const principals of [["company"], ["company", "u:ana"], ["u:ana"]]) {
      const got = ix.search({ query: "topic3 body4", asker: { principals }, k: 50 });
      expect(got.map((h) => h.id)).toEqual(oracle(all, principals, "topic3 body4", 50).map((h) => h.id));
    }
    ix.close();
  });
  it("refuses a file in the old FTS5 format instead of serving readable positions", () => {
    const old = new DatabaseSync(file());
    old.exec("CREATE VIRTUAL TABLE fts USING fts5(t, p, b, content='', detail=full)");
    old.close();
    expect(codeOf(() => open())).toBe("BAD_INDEX");
  });
  it("opening twice does not recreate or wipe the schema", () => {
    open().close();
    const ix = open();
    ix.index([doc("a", { title: "t" })]);
    ix.close();
    expect(open().search({ query: "t", asker })).toHaveLength(1);
  });
});
