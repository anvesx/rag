const WORD = /[\p{L}\p{N}\p{M}]+/gu;
const MAX_QUERY_CHARS = 10_000;
const MAX_TERMS = 32;

/** NFC, lower case, runs of letters, digits and combining marks. */
export const tokenize = (text: string): string[] => text.normalize("NFC").toLowerCase().match(WORD) ?? [];

/** Distinct tokens of a query, first-seen order. Reads at most 10000 characters and keeps 32 terms. */
export const queryTerms = (query: string): string[] => [...new Set(tokenize(query.slice(0, MAX_QUERY_CHARS)))].slice(0, MAX_TERMS);
