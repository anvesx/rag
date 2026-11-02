# Source

`fs/walk.ts` discovers workspace packages and source/test files. The four rule modules return structured
violations without printing or mutating the repository. `bin/cli.mjs` owns argument parsing, output,
and process exit codes.
