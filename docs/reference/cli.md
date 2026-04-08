# CLI Reference

## Top-Level Commands

| Command | Purpose |
| --- | --- |
| `alteran setup [dir]` | Bootstrap or repair a project directory |
| `alteran external <path-to-json> <command> [args...]` | Operate on an explicit foreign Alteran target from the current context |
| `alteran from app <name> <command> [args...]` | Rebase execution into a registered app context |
| `alteran from dir <project-dir> <command> [args...]` | Rebase execution into an explicit project directory |
| `alteran refresh` | Re-synchronize generated project state |
| `alteran shellenv [dir] [--shell=sh|batch]` | Print shell environment code |
| `alteran app ...` | Manage apps |
| `alteran tool ...` | Manage tools |
| `alteran reimport apps|tools <dir>` | Import discovered apps or tools from a directory |
| `alteran clean <scope> [<scope> ...]` | Remove recoverable local state |
| `alteran compact [dir]` | Reduce the active or explicit target project to bootstrap-ready transferable state |
| `alteran compact-copy <destination> [--source=<project-dir>]` | Create a compact transfer-ready copy without mutating the source project |
| `alteran run <file> [args...]` | Run a script through Alteran-managed Deno |
| `alteran task <name> [args...]` | Run a root Deno task inside the Alteran environment |
| `alteran test [filters/flags...]` | Shortcut for managed `deno test` |
| `alteran deno <args...>` | Pass raw Deno commands through the Alteran environment |
| `alteran x <module> [args...]` | Run a remote module through the Alteran environment |
| `alteran update` | Run dependency-update flow |
| `alteran upgrade [--alteran[=version]] [--deno[=version]]` | Upgrade installed runtime material |
| `alteran use --deno=<version>` | Set desired managed Deno version in project config |

## App Subcommands

`add`, `rm`, `purge`, `ls`, `run`, `setup`

## Tool Subcommands

`add`, `rm`, `purge`, `ls`, `run`

## External Context

`alteran external` is the explicit cross-project execution mode.

- supported anchors: `alteran.json`, `app.json`
- unsupported anchor: `deno.json`
- positional anchor takes precedence over `ALTERAN_EXTERNAL_CTX`
- external mode does not become the target project's context
- external mode does not auto-initialize the target as if it had been entered through `setup`

## Rebased Context

`alteran from` is the explicit context-rebased execution mode.

- `from app <name> ...` resolves a registered app from the current active project
- `from dir <project-dir> ...` resolves an explicit target project directory
- `from` becomes the target context before interpreting the remaining Alteran command
- if the target is not initialized yet, `from` may initialize it first

## Convenience Aliases

- `alt`
- `arun`
- `atask`
- `atest`
- `ax`
- `adeno`

Generated shell output can also include per-entry aliases from registry `shell_aliases` and arbitrary top-level `shell_aliases`.

## Navigation
- Home: [Docs Index](../README.md)
- Next: [`alteran.json` Reference](./alteran-json.md)
