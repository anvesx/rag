# scripts

Tools that are run by hand and are not part of the test suite.

- `bench/`: the open-loop latency bench. Run it with `pnpm --filter @rag/rank bench`, which builds `dist/` first because the scripts import the compiled package.
