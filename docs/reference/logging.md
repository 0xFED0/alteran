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

## Custom Mirror Destination

If `ALTERAN_CUSTOM_LOG_DIR` is set, Alteran may mirror the current root log
tree there as an additional copy target.

That does not replace the canonical project-local root under `.runtime/logs/`.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Tool Layout Reference](./tool-layout.md)
- Next: [Cleanup Scopes Reference](./cleanup-scopes.md)
