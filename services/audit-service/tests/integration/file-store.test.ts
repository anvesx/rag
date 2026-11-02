import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AnchorStoreError, createFileAnchorStore } from "../../src/index.js";

const dir = mkdtempSync(join(tmpdir(), "audit-anchors-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let n = 0;
let anchors = "";
beforeEach(() => {
  anchors = join(dir, `${n++}.anchors`);
});

describe("file anchor store", () => {
  const rec = (seq: number, hash: string) => ({ tenantId: "t", seq, hash, at: "x" });
  it("returns undefined when the file does not exist", async () => {
    expect(await createFileAnchorStore(anchors).latest("t")).toBeUndefined();
  });
  it("appends and never rewrites earlier lines", async () => {
    const st = createFileAnchorStore(anchors);
    await st.append(rec(1, "a"));
    const first = readFileSync(anchors, "utf8");
    await st.append(rec(2, "b"));
    expect(readFileSync(anchors, "utf8").startsWith(first)).toBe(true);
    expect(await st.latest("t")).toEqual(rec(2, "b"));
  });
  it("throws AnchorStoreError on a corrupt line", async () => {
    writeFileSync(anchors, "not json\n");
    await expect(createFileAnchorStore(anchors).latest("t")).rejects.toBeInstanceOf(AnchorStoreError);
    writeFileSync(anchors, '{"tenantId":"t","seq":-1,"hash":"a","at":"x"}\n');
    await expect(createFileAnchorStore(anchors).latest("t")).rejects.toBeInstanceOf(AnchorStoreError);
  });
  it("throws AnchorStoreError when the path is unwritable", async () => {
    const st = createFileAnchorStore(join(dir, "missing-dir", "a"));
    await expect(st.append(rec(1, "a"))).rejects.toBeInstanceOf(AnchorStoreError);
  });
  it("tolerates a trailing blank line", async () => {
    const st = createFileAnchorStore(anchors);
    await st.append(rec(1, "a"));
    appendFileSync(anchors, "\n");
    expect((await st.latest("t"))?.seq).toBe(1);
  });
});
