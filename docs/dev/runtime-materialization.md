# Runtime Materialization

Runtime materialization is the process of making a project locally runnable without treating `.runtime/` as authored source.

## Source Priority

Current design intent and implementation align around this order:

1. local authored source if available
2. already materialized local runtime if valid
3. archive sources for installation/materialization

Runnable bootstrap sources can launch Alteran, but they are not the canonical materialization source.

This separation is intentional: execution bootstrap and installation source are different responsibilities.

## What Gets Materialized

```text
.runtime/
  alteran/
  tools/
  libs/
  deno/
```

## Deno Materialization

Alteran manages one effective Deno version per runtime. The managed Deno lives under the platform-specific branch:

```text
.runtime/deno/<os>-<arch>/
```

## Source vs Generated State

- `src/alteran/`, `src/tools/`, `src/libs/`: authored source
- `.runtime/alteran/`, `.runtime/tools/`, `.runtime/libs/`: generated local material

## Remote Acquisition Boundary

- `ALTERAN_RUN_SOURCES`: bootstrap/execution sources
- `ALTERAN_ARCHIVE_SOURCES`: install/materialization sources

This split avoids recursive or incomplete runtime reconstruction from runnable URLs alone.

If a design starts solving missing local material by recursively re-entering a runnable remote bootstrap path, treat that as a smell and redesign the boundary.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Architecture](./architecture.md)
- Next: [Command Model](./command-model.md)
