# Concepts

These are the ideas that matter most when reasoning about Alteran correctly.

## Repository vs Managed Project

The Alteran source repository is not the same thing as an Alteran-managed project.

- the repository contains authored source under `src/`
- a managed project contains materialized Alteran runtime under `.runtime/`
- the repository intentionally mirrors the managed project shape, but it also has repository-only areas such as `src/`, `docs/`, `examples/`, and `dist/`

## Setup vs Activate

- `setup` and `setup.bat` are the public bootstrap surfaces
- `activate` and `activate.bat` are generated local entrypoints
- `setup` performs bootstrap and regeneration work
- `activate` is for entering the shell environment after bootstrap

On Unix-like shells, `activate` is a sourced-only artifact:

```sh
source ./activate
```

## Authored Source vs Generated State

Alteran draws a hard line between authored source and generated runtime state.

- authored Alteran source lives under `src/` in the repository
- project-owned code lives under `apps/`, `tools/`, `libs/`, and `tests/`
- generated local state lives under `.runtime/` and generated activation files

`.runtime/` should be safe to regenerate.

## Apps, Tools, Libs, And Tests

- `apps/` holds application entrypoints and app-local subprojects
- `tools/` holds project automation and helper commands
- `libs/` holds shared code
- `tests/` is a first-class top-level project category

Alteran treats apps and tools as related but distinct units:

- apps are run with `alteran app run <name>`
- tools are run with `alteran tool run <name>`

## Plain Deno vs Alteran-Managed Execution

Plain Deno remains plain.

- `deno run` and `deno task` keep normal Deno semantics
- `alteran run`, `alteran task`, `alteran tool run`, and `alteran app run` add Alteran preinit, runtime context, and logging behavior
- `alteran deno ...` runs Deno inside the Alteran environment without pretending plain Deno changed globally

## Local Runtime And Logging

Alteran keeps a project-local runtime under:

```text
.runtime/
```

That includes:

- Alteran runtime material
- project-local managed Deno
- runtime helper tools and libs
- logs

Logs are project-scoped. A root invocation gets one canonical log directory under `.runtime/logs/`, and child runs aggregate into that same root tree.

## View Is A Placeholder

`view/` is reserved as an extension point. It is not the center of the current product story, and Alteran should not be read as a desktop or GUI framework.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Quickstart](./quickstart.md)
- Next: [Project Layout](./project-layout.md)
