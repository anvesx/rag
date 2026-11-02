# structure-lint

`@rag/structure-lint` is the repository's structural CI gate. It checks every package directly
under `features`, `services`, `modules`, `apps`, and `tools`, then prints deterministic
`file:rule:message` diagnostics.

## Rules

- `.ts` and `.mjs` files below `src/` and `tests/` are limited to 80 physical lines.
- Source/test folders are limited to five implementation files; required README files are docs.
- Each package needs `src/`, `tests/`, and `README.md`; each source folder needs `README.md`.
- Workspace dependencies must point down: feature to core-types, service to feature, module to
  service/feature, app to module, and tool to feature, service or module (a tool is a leaf: nothing depends on it, and it never depends on an app).

## Run

```sh
node tools/structure-lint/bin/cli.mjs [--root /path/to/workspace]
```

Exit `0` means clean, `1` means violations or invalid package metadata, and `2` means zero packages
were found. Every run prints package and checked-file counts, so an empty gate cannot look green.

## Limits and development

Packages must be immediate children of the five tier folders. Symlinked directories are not
followed. The tool reports violations but does not auto-fix them. Run `pnpm test`, `pnpm typecheck`,
and `pnpm mutation` from this directory; tests create fixtures only in the operating-system temp
directory. The mutation command replaces only Stryker's worker-log socket with an in-memory sink,
so it also runs in CI sandboxes that prohibit listeners; worker control still uses process IPC.
