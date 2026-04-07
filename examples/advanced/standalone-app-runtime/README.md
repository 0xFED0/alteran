# Advanced Standalone App Runtime

## What this example shows

This example contains a standalone-style app scaffold outside the normal managed-project flow.

## Why it matters

Most Alteran work happens inside a managed project. Sometimes you still need to reason about an app as a self-contained runnable unit. This example keeps that story explicit and separate from the default workflow.

## Project shape / tree overview

```text
advanced/standalone-app-runtime/
  standalone-clock/
    .gitignore
    app.json
    deno.json
    setup
    setup.bat
    app
    app.bat
    core/mod.ts
    view/README.md
```

## How to run it

Bootstrap the app-local runtime:

```sh
cd ./standalone-clock
./setup
./app
```

If a usable `deno` is already available on your machine, `./setup` reuses it to seed the app-local runtime instead of downloading a fresh copy immediately.

After the first setup, the generated launcher is the normal entrypoint:

```sh
cd ./standalone-clock
./app red blue
```

## What to observe

- the app runs without depending on a managed project root;
- the scaffold still follows Alteran app conventions such as `app.json`, `core/`, `view/`, `setup`, and launcher scripts;
- no Alteran-managed runtime context is injected unless you run it inside a managed project on purpose.

## Key Alteran concepts demonstrated

- standalone-oriented app scaffold;
- difference between managed project execution and plain standalone execution.

## What this example intentionally does not cover

- managed project bootstrap;
- root `tools/` or `libs/`;
- structured logging integration.
