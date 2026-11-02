import { contentHash } from "@brain/connector-kit";
import type { ChangeEvent, IndexService } from "@rag/index-service";
import { describe, expect, it } from "vitest";
import { doc, setup } from "../support/harness.js";

const three = () => [doc("a"), doc("b"), doc("c")];
const searchable = (s: ReturnType<typeof setup>) => new Set(s.search("x").map((h) => h.docId)).size;

describe("one fetch per changed document, through to searchable", () => {
  it("first run fetches each document once and indexes it", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    expect(s.tokens).toHaveLength(3);
    expect(searchable(s)).toBe(3);
  });

  it("a rerun fetches nothing", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    await s.ingestion.runOnce("acme");
    expect(s.tokens).toHaveLength(3);
  });

  it("a modified document costs exactly one more fetch", async () => {
    const s = setup(three());
    await s.ingestion.runOnce("acme");
    s.set([doc("a"), doc("b", "v2", "changed text"), doc("c")]);
    await s.ingestion.runOnce("acme");
    expect(s.tokens).toHaveLength(4);
    expect(s.search("changed").length).toBeGreaterThan(0);
  });

  it("hands the index the text it fetched and its hash", async () => {
    const seen: ChangeEvent[] = [];
    const spy = (svc: IndexService): IndexService => ({
      apply: (e) => {
        seen.push(e);
        return svc.apply(e);
      },
    });
    const s = setup([doc("a", "v1", "héllo 日本語 🙂")], spy);
    await s.ingestion.runOnce("acme");
    const e = seen[0];
    const hash = contentHash("héllo 日本語 🙂");
    expect(e).toMatchObject({ type: "upsert", content: { text: "héllo 日本語 🙂", contentHash: hash }, pointer: { contentHash: hash } });
  });

  it("empty text is fetched once and indexed with zero chunks", async () => {
    const s = setup([doc("a", "v1", "")]);
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ emitted: 1, indexed: 1, failed: 0 });
    expect(s.tokens).toHaveLength(1);
    expect(s.rows()).toHaveLength(1);
  });

  it("a failed fetch is reported, never reaches the index, and a retry fetches once", async () => {
    const s = setup(three());
    s.broken.add("b");
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ indexed: 2, failed: 1, failures: [{ address: "b" }] });
    expect(s.tokens).toHaveLength(3);
    expect(s.rows().map((p) => p.address)).not.toContain("b");
    s.broken.clear();
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ indexed: 1, failed: 0 });
    expect(s.tokens).toHaveLength(4);
    expect(searchable(s)).toBe(3);
  });

  it("retry after an index failure costs one fetch per attempt, not two", async () => {
    const s = setup(three());
    s.state.failEmbed = true;
    await s.ingestion.runOnce("acme");
    expect(s.tokens).toHaveLength(3);
    s.state.failEmbed = false;
    expect(await s.ingestion.runOnce("acme")).toMatchObject({ indexed: 3, failed: 0 });
    expect(s.tokens).toHaveLength(6);
    expect(searchable(s)).toBe(3);
  });
});
