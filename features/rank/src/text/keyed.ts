import { createHmac } from "node:crypto";

export type Keyer = (token: string) => string;

/**
 * Maps a token to the term stored in the file: HMAC-SHA256 under the caller's key, cut to 128 bits.
 * Without the key the file holds no hex of any word, and a dictionary of guesses cannot be tested against it.
 */
export const termKeyer = (key: string | Uint8Array): Keyer => {
  const secret = Buffer.from(key);
  return (token) => createHmac("sha256", secret).update(token, "utf8").digest("hex").slice(0, 32);
};
