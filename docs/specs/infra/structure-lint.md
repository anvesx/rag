# Spec: structure-lint

Ticket: #38   Tier: tool   Milestone: M0

## Purpose
CLI that fails CI when the folder rules or tier direction are broken.
## Reuse decision
Node 26 built-ins only (`node:fs`, `node:path`); runs `.ts` natively (erasable syntax, `.ts` import
extensions). `dependency-cruiser` stays for import graphs; this tool checks tiers from package.json.
## Rules checked
1. No source file over 80 lines (`src/` and `tests/`, `.ts` `.mjs`).
2. No folder with more than 5 files. Subfolders are not files, and `README.md` is exempt from the count (so `src/` may hold 5 source files plus its README). `tests/<kind>/` counts per folder.
3. Every package has `src/`, `tests/`, `README.md`; every folder under `src/` has a README.md.
4. Tier direction: feature may depend only on `@anvesx/core-types`; service on features and core-types; module on services and features; app on modules; a tool may depend on feature, service and module; otherwise no upward or sideways workspace dependency, and nothing depends on a tool.
## Interface
`node tools/structure-lint/bin/cli.mjs [--root dir]`, prints `file:rule:message`, exit 1 on any violation, exit 2 when it found zero packages (a gate that measured nothing fails). Prints the denominator: packages and files checked.
## Acceptance tests (first)
unit per rule on fixtures; integration runs the CLI on a fixture tree (one violation per rule) and on the real repo; mutation >= 80.
## Layout
`tools/structure-lint/{bin/cli.mjs,src/{lines.ts,fanout.ts,layout.ts,tiers.ts,walk.ts},tests/,README.md}`.
## Out of scope
Auto-fix.
