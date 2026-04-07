# Architecture

Alteran is best understood as a small set of cooperating subsystems.

## 1. Public Entrypoints

- `alteran.ts`: stable public CLI/package entrypoint
- `setup` and `setup.bat`: public bootstrap entrypoints
- generated `activate` and `activate.bat`: local activation entrypoints

These are intentionally not all the same thing. `setup` owns bootstrap,
materialization, and repair. `activate` is only for entering a prepared local
environment.

## 2. Authored Runtime Source

The authored implementation lives under:

- `src/alteran/`
- `src/tools/`
- `src/libs/`

This is the source-of-truth that can be materialized into `.runtime/`.

## 3. Runtime Materialization

Managed projects run against:

```text
.runtime/alteran/mod.ts
```

Materialization can come from:

- local authored source
- an already installed local runtime
- archive sources for remote installation

Runnable remote sources may launch Alteran, but they are not the canonical
materialization source.

## 4. Config And Project Sync

Alteran maintains:

- `alteran.json`
- root `deno.json`
- app `deno.json`
- generated activation files
- generated app helper scripts

Refresh is the main synchronization operation.

## 5. Managed Execution

Managed execution is centered on preinit and project-scoped environment
context. `alteran run`, `alteran task`, `alteran app run`, and
`alteran tool run` participate; plain Deno does not silently change.

Cross-project execution is explicit. Foreign project context should not be
inherited accidentally.

## 6. Logging

Runs are logged under a canonical project-local root:

```text
.runtime/logs/
```

One root invocation gets one root log directory, and child runs aggregate into
that tree. External log destinations may mirror logs, but they do not replace
the canonical project-local root.

## 7. Publication

Publication is staged under versioned output directories:

- `dist/jsr/<version>/`
- `dist/zips/<version>/`

The intended primary public package identity is `@alteran`.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Repository Layout](./repository-layout.md)
- Next: [Runtime Materialization](./runtime-materialization.md)
