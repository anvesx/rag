import type { Doc } from "../../../src/index.js";
import { NOW } from "../../support/oracle.js";

/** One topic is a pair of words. Topic i owns A[i] and B[i]; no other doc is about it. */
export const A =
  "payroll invoice kubernetes onboarding firewall vaccine mortgage telescope glacier espresso turbine sonnet volcano antibody blockchain compiler pottery marathon saffron tungsten lighthouse origami parachute quartz rainforest submarine tapestry umbrella vineyard walrus xylophone yeast zeppelin archery bakery cathedral dolphin eclipse fjord gondola".split(
    " ",
  );
export const B =
  "ledger reconciliation cluster checklist policy schedule refinance mirror melt grinder blade rhyme eruption titer consensus parser kiln pacing harvest alloy keeper folding harness crystal canopy sonar loom handle trellis tusk mallet culture airship quiver sourdough spire pod shadow inlet oar".split(
    " ",
  );

const FILLER =
  "update meeting review planning status budget quarter team roadmap notes agenda summary action items follow report draft sync owner risk dependency release backlog sprint retro metric target outcome decision question answer detail context".split(
    " ",
  );

/** Small seeded generator (mulberry32) so the corpus is identical on every run. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const topicId = (i: number): string => String(i).padStart(2, "0");
export const team = (i: number): string => `team:${i % 4}`;

/** Interleave `words` among `len` filler words at seeded positions. */
const sentence = (r: () => number, len: number, words: string[]): string => {
  const out = Array.from({ length: len }, () => FILLER[Math.floor(r() * FILLER.length)] as string);
  for (const w of words) out[Math.floor(r() * len)] = w;
  return out.join(" ");
};

/**
 * Per topic: 6 docs ABOUT it (title names the topic, body mentions each word once; r0-r3 for everyone,
 * r4-r5 for one team only) and 4 docs that merely MENTION it (generic title, body repeats each word 3 times).
 */
export const corpus = (): Doc[] => {
  const r = rng(20260502);
  const age = () => NOW - Math.floor(r() * 400) * 86_400_000;
  const docs: Doc[] = [];
  for (let i = 0; i < A.length; i++) {
    const [a, b, t] = [A[i] as string, B[i] as string, topicId(i)];
    for (let j = 0; j < 6; j++) {
      docs.push({
        id: `t${t}-r${j}`,
        title: `${a} ${b} guide ${j}`,
        path: `/docs/${a}/guide-${j}.md`,
        body: sentence(r, 30, [a, b]),
        principals: j < 4 ? ["company"] : [team(i)],
        mtimeMs: age(),
        links: j === 0 ? [] : [`t${t}-r0`],
      });
    }
    for (let j = 0; j < 4; j++) {
      docs.push({
        id: `t${t}-d${j}`,
        title: `weekly notes ${j}`,
        path: `/notes/2026/week-${t}-${j}.md`,
        body: sentence(r, 30, [a, a, a, b, b, b]),
        principals: ["company"],
        mtimeMs: age(),
        links: [],
      });
    }
  }
  return docs;
};
