# 07 Compact Transfer Ready

## What this example shows

This example demonstrates the difference between durable project files and recoverable local runtime state.

## Why it matters

Alteran projects accumulate local runtime material such as `.runtime/`, log artifacts, and build output. `alteran compact` removes that recoverable state while leaving the authored project intact and ready to hydrate again later.

## Project shape / tree overview

```text
07-compact-transfer-ready/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  libs/
    persistence/mod.ts
  apps/
    portable-cli/
      app.json
      deno.json
      core/mod.ts
      view/README.md
  tools/
    project-status.ts
    project-status/mod.ts
```

## How to run it

```sh
./setup
source ./activate
alteran app run portable-cli
alteran tool run project-status
alteran compact -y
./setup
source ./activate
```

## What to observe

- before compact, `.runtime/` contains local Deno, Alteran runtime files, and logs;
- after compact, `.runtime/`, generated `activate` files, nested app runtimes, and `dist/` are removed;
- authored files such as `alteran.json`, `deno.json`, `apps/`, `tools/`, and `libs/` remain;
- running `setup` again restores the local runtime and regenerates `activate`.

## Key Alteran concepts demonstrated

- safe cleanup of regenerable local state;
- project portability and transfer-ready layout;
- rehydration after compact.

## What this example intentionally does not cover

- bootstrap from an empty folder;
- external reimport flows;
- structured LogTape categories.
