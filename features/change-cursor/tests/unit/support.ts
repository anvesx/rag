import { CursorError } from "../../src/errors.js";

/** Returns the CursorError that fn throws. Fails if fn throws anything else or throws nothing. */
export function thrownBy(fn: () => unknown): CursorError {
  try {
    fn();
  } catch (err) {
    if (err instanceof CursorError) return err;
    throw err;
  }
  throw new Error("expected a CursorError, but nothing was thrown");
}
