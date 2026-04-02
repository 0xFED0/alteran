# 05 Logging Run Tree

## What this example shows

This example runs a tool that prints to both stdout and stderr and then starts a
child Alteran-managed run.

## Why it matters

Console text disappears quickly. Alteran keeps an inspectable runtime history
under `.runtime/logs/`, including per-run metadata and parent-child execution
relationships.

## Project shape / tree overview

```text
05-logging-run-tree/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  libs/
    run_summary/mod.ts
  tools/
    run-pipeline.ts
    run-pipeline/
      child.ts
      mod.ts
```

## How to run it

```sh
./setup
source ./activate
alteran tool run run-pipeline alpha beta
```

## What to observe

- parent output is mirrored to the terminal and captured in log files;
- child output is also captured and linked back to the parent invocation;
- `.runtime/logs/...` contains metadata, stdout, stderr, and structured events;
- parent/child relationships stay visible through invocation ids and event data.

## Key Alteran concepts demonstrated

- managed stdout and stderr capture;
- per-run log artifacts;
- nested run-tree visibility across parent and child executions.

## What this example intentionally does not cover

- richer structured logging with LogTape categories;
- standalone apps;
- refresh and compact flows.
