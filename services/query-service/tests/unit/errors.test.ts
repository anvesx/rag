import { SearchError } from "@rag/hybrid-search";
import { describe, expect, it } from "vitest";
import { wrap } from "../../src/errors.js";
import { QueryError } from "../../src/index.js";
import { req, pagedRig as rig } from "../fakes.js";

const caught = (fn: () => unknown): QueryError => {
  try {
    fn();
  } catch (e) {
    return e as QueryError;
  }
  throw new Error("did not throw");
};

describe("QueryError", () => {
  it("is named, carries its code as message and has no cause unless given one", () => {
    const bare = new QueryError("LIMIT");
    expect(bare).toMatchObject({ name: "QueryError", code: "LIMIT", message: "LIMIT" });
    expect(Object.hasOwn(bare, "cause")).toBe(false);
    const cause = new Error("c");
    expect(new QueryError("BACKEND", cause).cause).toBe(cause);
  });
});

describe("wrap", () => {
  it("rethrows a QueryError as the same instance", () => {
    const original = new QueryError("PRINCIPAL");
    expect(caught(() => wrap(original))).toBe(original);
  });

  it("maps a SearchError DIM to EMBEDDING and keeps the cause", () => {
    const dim = new SearchError("DIM");
    const err = caught(() => wrap(dim));
    expect(err).toMatchObject({ code: "EMBEDDING", cause: dim });
  });

  it("maps a SearchError with another code to BACKEND", () => {
    expect(caught(() => wrap(new SearchError("INPUT"))).code).toBe("BACKEND");
  });

  it("maps a non-SearchError that merely has code DIM to BACKEND", () => {
    const lookalike = Object.assign(new Error("x"), { code: "DIM" });
    expect(caught(() => wrap(lookalike)).code).toBe("BACKEND");
  });

  it("wraps a thrown non-Error value as BACKEND", () => {
    expect(caught(() => wrap("oops"))).toMatchObject({ code: "BACKEND", cause: "oops" });
  });
});

describe("service error paths", () => {
  it("searchLive maps an index failure to BACKEND", async () => {
    const { service, index } = rig(10, 0);
    index.search = () => {
      throw new Error("index down");
    };
    await expect(service.searchLive(req())).rejects.toMatchObject({ name: "QueryError", code: "BACKEND" });
  });

  it("searchLive maps a wrong-dimension embedding to EMBEDDING", async () => {
    const { service, index } = rig(10, 0);
    index.search = () => {
      throw new SearchError("DIM");
    };
    await expect(service.searchLive(req())).rejects.toMatchObject({ code: "EMBEDDING" });
  });

  it("a missing request is a PRINCIPAL error, not a TypeError", () => {
    const { service } = rig(1, 0);
    expect(caught(() => service.search(undefined as never))).toMatchObject({ name: "QueryError", code: "PRINCIPAL" });
  });
});
