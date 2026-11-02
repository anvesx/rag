# eval

Relevance quality, measured with standard metrics.

- `metrics.ts`: `ndcgAt` (binary gain, `1 / log2(rank + 1)`, normalised by the ideal list capped at k), `recallAt`, `mrr`, `mean`.
- `metrics.test.ts`: each metric against values worked out by hand, plus empty and cut-off cases.
- `run.ts`: indexes the generated corpus, runs every golden query as the labelled asker, and averages nDCG@10, recall@20 and MRR. It accepts column weights so the same code scores BM25F and the plain baseline.
- `quality.test.ts`: checks the golden set (at least 40 queries, every label exists and is permitted to its asker) and asserts BM25F beats plain bm25 (weights 1, 1, 1) on nDCG@10.
- `data/`: the corpus generator and the golden queries.

## Result of the last run

| Ranker                        | nDCG@10 | recall@20 | MRR   |
| ----------------------------- | ------- | --------- | ----- |
| BM25F, weights 3 / 2 / 1      | 0.989   | 1.000     | 1.000 |
| Plain bm25, weights 1 / 1 / 1 | 0.766   | 1.000     | 0.745 |

The labels were written before the first run and were not changed afterwards.

## What this does and does not show

The corpus is synthetic. A doc is relevant to a topic when its title names the topic. A distractor mentions the topic words three times in its body under a generic title. This encodes the premise that a title match signals what a doc is about, and BM25F is built on that premise, so the comparison checks that the weights and per-column length normalisation work as designed. It is not evidence about how the ranker performs on real company documents. That needs labelled real queries.
