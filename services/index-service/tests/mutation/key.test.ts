import { describe, expect, it } from "vitest";
import { IndexServiceError } from "../../src/index.js";
import { B, embedText, pointer, setup, sha, T } from "../support/harness.js";

describe("IndexServiceError", () => {
  it("has no cause property when none is given, and carries one when it is", () => {
    const bare = new IndexServiceError("INDEX_FAILED");
    expect("cause" in bare).toBe(false);
    expect(bare.message).toBe("INDEX_FAILED");
    const cause = new Error("x");
    expect(new IndexServiceError("INDEX_FAILED", cause).cause).toBe(cause);
  });
});

describe("per document serialisation key", () => {
  it("lets different documents run concurrently", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const embed = async (ts: string[]) => {
      calls++;
      if (calls === 1) await gate;
      else release();
      return ts.map(embedText);
    };
    const { svc } = setup({ ...T, "acme/d2@v1": B }, { embed });
    const both = Promise.all([
      svc.apply({ type: "upsert", pointer: pointer() }),
      svc.apply({ type: "upsert", pointer: pointer({ id: "d2", address: "drive://d2", contentHash: sha(B) }) }),
    ]);
    const stuck = new Promise<string>((resolve) => setTimeout(resolve, 500, "stuck"));
    const outcome = await Promise.race([both.then(() => "done"), stuck]);
    release();
    expect(outcome).toBe("done");
  });
});
