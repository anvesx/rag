import { RankError } from "../../src/index.js";

/** The RankError code a call throws, or "none". Any other error is rethrown. */
export const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RankError) return e.code;
    throw e;
  }
  return "none";
};

/** Pass a deliberately wrong value through the typed API. */
export const bad = (x: unknown) => x as never;
