# property

Randomised and adversarial checks, built on fast-check.

- `acl.property.test.ts`: for random docs, askers and queries, (1) results are a subset of the docs the asker may read, (2) results equal the brute-force oracle's, ids and order, and (3) the same holds after random re-indexing and removal.
- `canary.test.ts`: adds a hidden canary doc that matches the query perfectly and shows that results, scores, counts and order are exactly unchanged, for random corpora and for a hand-written case.
- `fakes.test.ts`: the no-fake guard. One set of checks runs against the real index and against four stubs (always empty, ignores the ACL, no ranking, constant answer). The real index must pass and every stub must fail, so the suite cannot go green on a fake.

The oracle in `../support/oracle.ts` shares no code with `src`. It recomputes the formula from the spec with plain arrays.
