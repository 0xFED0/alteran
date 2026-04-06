# Logging

Alteran logging is built around a canonical per-project root log directory and
root-invocation aggregation.

## Canonical Root

Logs live under:

```text
<project>/.runtime/logs/
```

That project-local root is authoritative for run identity and debugging.

## Root Invocation Model

One root Alteran invocation gets one root log directory. Child runs do not
create unrelated top-level trees. Instead, they append into the same root
invocation's:

- `stdout.log`
- `stderr.log`
- `events.jsonl`

## Context Variables

Managed execution propagates logging context through environment variables such
as:

- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_PARENT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`
- `ALTERAN_LOG_MODE`
- `ALTERAN_LOG_CONTEXT_JSON`

## LogTape Boundary

LogTape integration is optional. Alteran can proxy the bare
`@logtape/logtape` import through its internal logging bootstrap surface when
enabled.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Managed Execution](./managed-execution.md)
- Next: [Testing](./testing.md)
