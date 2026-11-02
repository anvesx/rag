# unit

`reindex.test.ts` runs `reindex` over a real folder connector and a real rank file, and records the documents it hands to the gate. `lifecycle.test.ts` covers deletes and gate-tag changes. `token.test.ts` checks that a missing, null, empty, blank or non-string token throws `TokenRequiredError` and fetches nothing.
