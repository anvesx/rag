# Paging and live ACL

- `scan.ts` pages through the index (offset and limit) until `limit` visible hits are collected, the index is exhausted, or `maxCandidates` is reached. It is a generator: it yields each page's cached-visible pointers and takes back the ids that survived further checks. No IO of its own.
- `live.ts` asks the live source about one page of hits. Only an explicit `allow` keeps a hit. `deny`, `unknown`, a missing id, a throw, a timeout and a malformed result all drop it. `verifyNeeded` asks in steps of at most the number of hits still missing, and flags `halt` when a step yields no verdict.
