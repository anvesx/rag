import { describe, expect, it } from "vitest";
import { combine, DAY_MS, idf, linkSignal, recency, textScore, WEIGHTS } from "../../src/text/formula.js";

const c = (title: number, path: number, body: number) => ({ title, path, body });
const ten = c(10, 10, 10);

describe("idf", () => {
  it("matches hand-computed ln(1 + (N - df + 0.5) / (df + 0.5))", () => {
    expect(idf(10, 1)).toBeCloseTo(1.99243, 5);
    expect(idf(10, 10)).toBeCloseTo(0.04652, 5);
  });
  it("stays positive when every doc has the term", () => {
    expect(idf(1, 1)).toBeGreaterThan(0);
  });
});

describe("textScore", () => {
  it("is idf * tf / (k1 + tf) for a body hit at average length", () => {
    expect(textScore([{ idf: 2, tf: c(0, 0, 1) }], ten, ten, WEIGHTS)).toBeCloseTo(0.909091, 6);
  });
  it("counts a title hit three times a body hit before saturation", () => {
    expect(textScore([{ idf: 2, tf: c(1, 0, 0) }], ten, ten, WEIGHTS)).toBeCloseTo(1.428571, 6);
  });
  it("orders title above path above body", () => {
    const at = (tf: ReturnType<typeof c>) => textScore([{ idf: 1, tf }], ten, ten, WEIGHTS);
    expect(at(c(1, 0, 0))).toBeGreaterThan(at(c(0, 1, 0)));
    expect(at(c(0, 1, 0))).toBeGreaterThan(at(c(0, 0, 1)));
  });
  it("normalizes by length with b = 0.75", () => {
    expect(textScore([{ idf: 2, tf: c(0, 0, 1) }], c(10, 10, 20), ten, WEIGHTS)).toBeCloseTo(0.645161, 6);
  });
  it("ignores a column whose average length is zero", () => {
    expect(textScore([{ idf: 2, tf: c(5, 0, 0) }], c(0, 0, 0), c(0, 10, 10), WEIGHTS)).toBe(0);
  });
  it("sums terms", () => {
    const one = textScore([{ idf: 2, tf: c(0, 0, 1) }], ten, ten, WEIGHTS);
    expect(
      textScore(
        [
          { idf: 2, tf: c(0, 0, 1) },
          { idf: 2, tf: c(0, 0, 1) },
        ],
        ten,
        ten,
        WEIGHTS,
      ),
    ).toBeCloseTo(2 * one, 9);
  });
  it("equal weights make the columns interchangeable", () => {
    const eq = c(1, 1, 1);
    expect(textScore([{ idf: 1, tf: c(1, 0, 0) }], ten, ten, eq)).toBe(textScore([{ idf: 1, tf: c(0, 0, 1) }], ten, ten, eq));
  });
});

describe("recency, links, combine", () => {
  it("halves every 90 days", () => {
    expect(recency(0, 0)).toBe(1);
    expect(recency(90 * DAY_MS, 0)).toBeCloseTo(0.5, 12);
    expect(recency(180 * DAY_MS, 0)).toBeCloseTo(0.25, 12);
  });
  it("treats a future mtime as age zero", () => {
    expect(recency(0, DAY_MS)).toBe(1);
  });
  it("is ln(1 + inbound)", () => {
    expect(linkSignal(0)).toBe(0);
    expect(linkSignal(3)).toBeCloseTo(1.386294, 6);
  });
  it("scales text by 1 + 0.2 recency + 0.1 links", () => {
    expect(combine(2, 0.5, Math.log(4))).toBeCloseTo(2.477259, 6);
    expect(combine(0, 1, 5)).toBe(0);
  });
});
