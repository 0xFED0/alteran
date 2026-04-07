# 04 Managed Vs Plain Deno

## What this example shows

This example runs the same probe code in two modes:

- plain `deno run`;
- Alteran-managed `alteran tool run`.

## Why it matters

Alteran is intentionally not just a shortcut for Deno. Managed execution adds
preinit context, runtime environment variables, and log capture while still
running normal Deno code.

## Project shape / tree overview

```text
04-managed-vs-plain-deno/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  tools/
    context-probe.ts
    context-probe/mod.ts
```

## How to run it

```sh
./setup
source ./activate
deno run -A ./tools/context-probe.ts
alteran tool run context-probe
```

## What to observe

- plain `deno run` reports `managed=no`;
- managed execution reports `managed=yes`;
- managed execution exposes `ALTERAN_HOME`, a run id, and a root log dir;
- the committed `.env` keeps setup local to the repository source tree;
- the code path itself stays the same.

## Key Alteran concepts demonstrated

- plain Deno remains valid;
- Alteran-managed execution injects context and preinit;
- environment and logging structure become visible only in managed mode.

## What this example intentionally does not cover

- multiple apps or tools;
- child run trees;
- compact or refresh workflows.
