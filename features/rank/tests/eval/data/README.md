# eval/data

- `corpus.ts`: a seeded generator (mulberry32, seed 20260502), identical on every run. It builds 40 topics, each a pair of words, with 10 docs per topic (400 docs).
  - Six docs are about the topic: `tNN-r0` to `tNN-r5`. The title names the topic, the body mentions each word once, the others link to `r0`. `r0` to `r3` are readable by `company`, `r4` and `r5` only by one team (`team:` plus topic number mod 4).
  - Four docs only mention it: `tNN-d0` to `tNN-d3`. They have a generic title and repeat each topic word three times in the body.
- `golden.json`: 46 hand-written queries. Each has the asker's principals and the labelled relevant ids, which are the on-topic docs that asker may read (four for `company`, six for the team asker, whose restricted docs count). Queries include two-word, one-word and sentence forms.

The labels follow from how the corpus is built, not from running the ranker.
