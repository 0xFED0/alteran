# Reading Logs

Alteran keeps a project-local execution history under `.runtime/logs/`.

## Where Logs Live

Root runs are grouped by type:

```text
.runtime/logs/
  apps/
  tools/
  tasks/
  tests/
  runs/
```

Each root invocation directory typically contains:

- `metadata.json`
- `stdout.log`
- `stderr.log`
- `events.jsonl`

## Parent And Child Runs

Child processes do not create unrelated top-level log trees. They aggregate
into the same root invocation directory, and their lifecycle shows up in
`events.jsonl`.

## What To Look At

- `metadata.json`: run identity, argv, timestamps, platform, exit code
- `stdout.log`: captured standard output for the root invocation tree
- `stderr.log`: captured standard error for the root invocation tree
- `events.jsonl`: structured lifecycle and process events

If you use `ALTERAN_CUSTOM_LOG_DIR`, treat it as an additional mirror/copy
location. The canonical run identity still lives under the project's own
`.runtime/logs/`.

## Related Example

See [05-logging-run-tree](../../../examples/05-logging-run-tree/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Standalone Apps](./standalone-apps.md)
- Next: [Mirrors And Sources](./mirrors-and-sources.md)
