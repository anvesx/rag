/** n space-separated words w0..w(n-1), for tests that need splittable text. */
export const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
