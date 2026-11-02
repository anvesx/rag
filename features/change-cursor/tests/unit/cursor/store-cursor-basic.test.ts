import { describe, expect, it } from "vitest";
import { createCursorStore } from "../../../src/store.js";

const fresh = () => createCursorStore(":memory:", () => 0);

describe("cursors", () => {
  it("returns undefined before any cursor is set", () => {
    expect(fresh().getCursor("t1", "drive")).toBeUndefined();
  });

  it("stores and reads back a cursor", () => {
    const s = fresh();
    s.setCursor("t1", "drive", "page-2");
    expect(s.getCursor("t1", "drive")).toBe("page-2");
  });

  it("lets the last write win", () => {
    const s = fresh();
    s.setCursor("t1", "drive", "a");
    s.setCursor("t1", "drive", "b");
    expect(s.getCursor("t1", "drive")).toBe("b");
  });

  it("keeps tenants and sources apart", () => {
    const s = fresh();
    s.setCursor("t1", "drive", "a");
    s.setCursor("t2", "drive", "b");
    s.setCursor("t1", "slack", "c");
    expect([s.getCursor("t1", "drive"), s.getCursor("t2", "drive"), s.getCursor("t1", "slack")]).toEqual(["a", "b", "c"]);
    expect(s.getCursor("t2", "slack")).toBeUndefined();
  });

  it("accepts unicode keys and values", () => {
    const s = fresh();
    s.setCursor("組織-ü", "来源/doc", "カーソル-😀");
    expect(s.getCursor("組織-ü", "来源/doc")).toBe("カーソル-😀");
  });

  it("accepts an empty cursor value", () => {
    const s = fresh();
    s.setCursor("t1", "drive", "");
    expect(s.getCursor("t1", "drive")).toBe("");
  });
});
