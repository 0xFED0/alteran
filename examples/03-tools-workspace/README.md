# 03 Tools Workspace

## What this example shows

This example treats `tools/` as a maintained project surface instead of an unstructured scripts folder.

It contains two realistic tools:

- `check-env` reports managed runtime context;
- `release-notes` formats release items into a compact changelog block.

## Why it matters

Operational helpers, diagnostics, and project automation age badly when they live as ad hoc shell snippets. Alteran gives them the same managed runtime and shared library structure as apps.

## Project shape / tree overview

```text
03-tools-workspace/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  libs/
    table/mod.ts
  tools/
    check-env.ts
    check-env/mod.ts
    release-notes.ts
    release-notes/mod.ts
```

## How to run it

```sh
./setup
source ./activate
alteran tool run check-env
alteran tool run release-notes 0.2.0 added-fixed-polished
```

## What to observe

- tools run through the same managed environment as apps;
- the committed `.env` keeps setup local to this repository checkout;
- shared formatting code lives in `libs/`, not duplicated in each tool;
- tool output stays readable and copyable without turning into shell sprawl.

## Key Alteran concepts demonstrated

- `tools/` as first-class project elements;
- shared code reuse from root `libs/`;
- managed execution for internal automation.

## What this example intentionally does not cover

- app-local library shadowing;
- nested log run trees;
- external reimport flows.
