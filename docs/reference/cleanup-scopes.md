# Cleanup Scopes Reference

## `alteran clean`

| Scope | Effect |
| --- | --- |
| `cache` | Remove `.runtime/deno/<platform>/cache` |
| `runtime` | Remove generated runtime state under `.runtime/` and rebuild expected structure |
| `env` | Remove generated `activate` and `activate.bat` |
| `app-runtimes` | Remove nested `apps/*/.runtime/` |
| `logs` | Remove `.runtime/logs/` and recreate the log root |
| `builds` | Remove `dist/` and recreate `dist/jsr/` |
| `all` | Run the safe cleanup set for regenerable runtime state |

## `alteran compact`

`compact` goes further than `clean all` by removing:

- root `.runtime/`
- nested app runtimes
- `dist/`
- generated `activate` and `activate.bat`

while preserving user source, config, and public setup files.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Logging Reference](./logging.md)
