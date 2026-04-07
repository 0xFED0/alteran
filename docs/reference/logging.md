# Logging Reference

## Root Location

```text
.runtime/logs/
```

## Top-Level Categories

- `apps/`
- `tools/`
- `tasks/`
- `tests/`
- `runs/`

## Root Invocation Directory Contents

| File | Meaning |
| --- | --- |
| `metadata.json` | Root run metadata |
| `stdout.log` | Captured standard output |
| `stderr.log` | Captured standard error |
| `events.jsonl` | Structured lifecycle and process events |

## Aggregation Rule

Child runs aggregate into the same root invocation directory rather than
creating separate top-level log trees.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Tool Layout Reference](./tool-layout.md)
- Next: [Cleanup Scopes Reference](./cleanup-scopes.md)
