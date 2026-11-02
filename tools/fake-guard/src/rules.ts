export type Finding = { file: string; rule: string; line: number };

const REAL_TIER = /\/tests\/(integration|e2e|scale)\//;
const FAKE_WORD = /\b\w*(fake|stub|mock)\w*\b/i;
const FAKE_EXPORT = /export\s+(?:const|function|class)\s+\w*(?:fake|stub|mock)\w*/i;
const MODULE_MOCK = /\b(?:vi|jest)\.(?:mock|doMock)\(/;

const hits = (text: string, pattern: RegExp): number[] => text.split("\n").flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));

/** Rules that keep fakes out of production code and out of the tests that claim to prove real behaviour. */
export const scanFile = (file: string, text: string): Finding[] => {
  const found: Finding[] = [];
  const add = (rule: string, lines: number[]) => {
    for (const line of lines) found.push({ file, rule, line });
  };
  const isSrc = file.includes("/src/");
  const isTest = file.includes("/tests/");
  if (isSrc && /fake|stub|mock/i.test(file.split("/").pop() ?? "")) add("src-ships-fake", [1]);
  if (isSrc) add("src-ships-fake", hits(text, FAKE_EXPORT));
  if (isTest) add("mocks-own-code", hits(text, MODULE_MOCK));
  if (REAL_TIER.test(file)) {
    add("memory-db-in-real-tier", hits(text, /:memory:/));
    add("fake-in-real-tier", hits(text, FAKE_WORD));
  }
  return found;
};
