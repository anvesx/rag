# fake-guard

Fails the build when tests or production code lean on fakes. It exists because green tests against fakes proved nothing about real systems.

## Rules

| Rule                     | Fires when                                                                  |
| ------------------------ | --------------------------------------------------------------------------- |
| `src-ships-fake`         | a file under `src/` is named or exports something called fake, stub or mock |
| `mocks-own-code`         | a test calls `vi.mock`, `vi.doMock` or the jest equivalents                 |
| `memory-db-in-real-tier` | a test under `integration`, `e2e` or `scale` uses `:memory:` SQLite         |
| `fake-in-real-tier`      | a test under `integration`, `e2e` or `scale` mentions a fake, stub or mock  |

## Ratchet

`fake-baseline.json` lists findings that existed when the guard was added. New findings fail. Baseline entries that no longer occur also fail, so the file can only shrink. Regenerate with `node tools/fake-guard/bin/cli.mjs --init` only after fixing things, never to hide them.

## Run

```bash
pnpm guard:fakes
```
