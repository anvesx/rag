# scripts/bench

Latency bench for `RankIndex.search`.

- `corpus.mjs`: seeded generator for docs and queries. Words follow a rough Zipf curve over a 3000 word vocabulary, so a few terms are very common. Each doc has a 5 word title, an 80 word body, one principal (30 percent `company`, the rest one of 20 groups) and 0 to 3 links. Queries are 1 to 3 words from the same curve, asked by one or two principals.
- `run.mjs`: the harness.

```
pnpm --filter @rag/rank bench
node scripts/bench/run.mjs --sizes 1000,10000 --rate 20 --samples 1500
```

## Method

- Open loop. Query i is scheduled at `start + i / rate`. The bench waits for that instant, runs the query, and records latency from the scheduled time, not from when the query started. If a query runs long, the ones queued behind it are charged the wait, so the tail is not hidden (coordinated omission).
- HdrHistogram (`hdr-histogram-js`), microsecond resolution, 3 significant digits.
- 200 warm-up queries first, then at least 1000 recorded samples (1500 by default).
- Per-stage timings come from the `probe(stage, ms)` callback of `search`: `terms`, `stats`, `postings`, `meta`, `links`, `score`.
- Index size is the SQLite file size divided by doc count after a clean close.
- CPU per query is `process.cpuUsage()` user plus system over the run, divided by the sample count.
- Search is synchronous, so the rate must stay below `1000 / cpu_ms_per_query`. At 10,000 docs that is about 37 per second, which is why the default is 20. A higher rate makes the queue grow without bound and the numbers become a backlog measurement.
