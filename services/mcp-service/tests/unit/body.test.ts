import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readJson } from "../../src/http/body.js";
import type { McpServiceError } from "../../src/index.js";

const stream = (...chunks: string[]) => Readable.from(chunks.map((c) => Buffer.from(c))) as never;
const codeOf = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as McpServiceError).code;

describe("readJson", () => {
  it("parses JSON split across chunks, including multibyte characters", async () => {
    const bytes = Buffer.from('{"a":"hé"}');
    const cut = bytes.indexOf(0xc3) + 1;
    const split = Readable.from([bytes.subarray(0, cut), bytes.subarray(cut)]) as never;
    expect(await readJson(split, 100)).toEqual({ a: "hé" });
    expect(await readJson(stream('{"a":', "1}"), 100)).toEqual({ a: 1 });
  });
  it("rejects invalid JSON and empty bodies as BAD_JSON", async () => {
    expect(await codeOf(readJson(stream("{x"), 100))).toBe("BAD_JSON");
    expect(await codeOf(readJson(stream(""), 100))).toBe("BAD_JSON");
  });
  it("rejects bodies over the limit as BODY_TOO_LARGE, accepts exactly the limit", async () => {
    expect(await codeOf(readJson(stream('{"a":"xxxxxxxxxx"}'), 5))).toBe("BODY_TOO_LARGE");
    expect(await readJson(stream("[1,2]"), 5)).toEqual([1, 2]);
  });
});
