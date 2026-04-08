# Cleanup Scopes Reference

## `alteran clean`

| Scope | Effect |
| --- | --- |
| `cache` | Remove `.runtime/deno/<platform>/cache` |
| `runtime` | Remove generated runtime state under `.runtime/` and rebuild expected structure |
| `env` | Remove generated `activate` and `activate.bat` |
| `app-runtimes` | Remove nested `apps/*/.runtime/` |
| `logs` | Remove `.runtime/logs/` and recreate the log root |
| `builds` | Remove `dist/` without recreating publication-specific subdirectories |
| `all` | Run the safe cleanup set for regenerable runtime state |

## `alteran compact [dir]`

`compact` goes further than `clean all` by removing:

- root `.runtime/`
- nested app runtimes
- `dist/`
- generated `activate` and `activate.bat`

while preserving user source, config, and public setup files.

Without `[dir]`, it compacts the current active project.

With `[dir]`, it explicitly targets another Alteran project directory.

## `alteran compact-copy <destination> [--source=<project-dir>]`

`compact-copy` creates a transfer-ready compact copy without mutating the source project.

It omits the same runtime, activation, nested app runtime, and build artifacts that `compact` removes in place.

If `--source` is omitted, the current active project is used as the source.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Logging Reference](./logging.md)
