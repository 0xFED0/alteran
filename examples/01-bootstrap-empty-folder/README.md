# 01 Bootstrap Empty Folder

## What this example shows

This example starts almost empty on purpose.

It demonstrates the first Alteran story: a near-empty directory becomes a usable
managed project after bootstrap and activation.

## Why it matters

Alteran is not only a collection of scripts. Its core promise is local,
reproducible project entry with a project-owned runtime layout.

## Project shape / tree overview

Before bootstrap:

```text
01-bootstrap-empty-folder/
  README.md
  .env
  setup
  setup.bat
```

After bootstrap:

```text
01-bootstrap-empty-folder/
  .gitignore
  activate
  activate.bat
  setup
  setup.bat
  alteran.json
  deno.json
  apps/
  tools/
  libs/
  tests/
  .runtime/
```

## How to run it

From this directory:

```sh
./setup
source ./activate
```

Or from the repository root:

```sh
./setup ./examples/01-bootstrap-empty-folder
source ./examples/01-bootstrap-empty-folder/activate
```

## What to observe

- `ALTERAN_HOME` points at `./.runtime`.
- The committed `.env` points `ALTERAN_SRC` at the repository `src/` tree, so
  setup can materialize Alteran from local authored source in this checkout.
- Local runtime material appears under `.runtime/`.
- Root project markers such as `alteran.json`, `deno.json`, and `activate` are
  created locally.
- The example is usable immediately even though it did not start with app code.

## Key Alteran concepts demonstrated

- bootstrap from an empty folder;
- activation as the entrypoint into a managed environment;
- generated local runtime state versus authored source files.

## What this example intentionally does not cover

- multiple apps;
- tools;
- managed execution differences;
- logging or refresh workflows.
