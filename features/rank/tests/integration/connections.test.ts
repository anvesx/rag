import { describe, expect, it } from "vitest";
import { doc, open as memory } from "../support/docs.js";
import { useTmpFile } from "../support/tmpfile.js";

const asker = { principals: ["company"] };
const { open } = useTmpFile();

describe("two connections to one file", () => {
  it("lets a second connection read whole index calls while the first writes", () => {
    const writer = open();
    const reader = open();
    const seen: number[] = [];
    for (let i = 0; i < 30; i++) {
      writer.index(Array.from({ length: 10 }, (_, j) => doc(`d${j}`, { title: `gen${i} shared` })));
      seen.push(reader.search({ query: "shared", asker, k: 100 }).length);
    }
    expect(seen).toEqual(Array(30).fill(10));
    writer.close();
    reader.close();
  });
  it("sees a revoke from another connection on the next search", () => {
    const writer = open();
    const reader = open();
    writer.index([doc("a", { title: "t", principals: ["u:ana"] })]);
    expect(reader.search({ query: "t", asker: { principals: ["u:ana"] } })).toHaveLength(1);
    writer.index([doc("a", { title: "t", principals: ["u:bo"] })]);
    expect(reader.search({ query: "t", asker: { principals: ["u:ana"] } })).toEqual([]);
    writer.close();
    reader.close();
  });
  it("never shows half an index call when calls interleave on one handle", async () => {
    const ix = memory();
    const seen: number[] = [];
    const writer = async () => {
      for (let i = 0; i < 50; i++) {
        ix.index(Array.from({ length: 20 }, (_, j) => doc(`d${j}`, { title: `gen${i}` })));
        await Promise.resolve();
      }
    };
    const reader = async () => {
      for (let i = 0; i < 50; i++) {
        seen.push(ix.search({ query: "gen0 gen1 gen2 gen3 gen4 gen5 gen6 gen7 gen8 gen9", asker, k: 100 }).length);
        await Promise.resolve();
      }
    };
    await Promise.all([writer(), reader()]);
    expect(seen.every((n) => n === 0 || n === 20)).toBe(true);
  });
});
