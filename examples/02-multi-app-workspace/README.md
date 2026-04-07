# 02 Multi App Workspace

## What this example shows

This example shows one Alteran project containing two apps and shared root libraries.

It also demonstrates app-local library shadowing: both apps import the same `@libs/greeting` alias, but `hello-cli` overrides the root implementation.

## Why it matters

Alteran is designed for structured multi-app work, not only for a single script. Root `libs/` provide shared code, while app-local `libs/` allow intentional overrides without inventing a separate monorepo pattern.

## Project shape / tree overview

```text
02-multi-app-workspace/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  libs/
    greeting/mod.ts
    workspace_info/mod.ts
  apps/
    hello-cli/
      app.json
      deno.json
      core/mod.ts
      libs/
        greeting/mod.ts
      view/README.md
    ops-report/
      app.json
      deno.json
      core/mod.ts
      view/README.md
```

## How to run it

```sh
./setup
source ./activate
alteran app run hello-cli
alteran app run ops-report
```

## What to observe

- both apps live under one workspace and are runnable independently;
- the committed `.env` lets `./setup` materialize Alteran from repository source when run inside this checkout;
- `hello-cli` prints a greeting from its app-local `libs/greeting`;
- `ops-report` prints the shared root greeting from `libs/greeting`;
- root `deno.json` contains workspace entries and app tasks synchronized by setup/refresh.

## Key Alteran concepts demonstrated

- `apps/` as first-class project units;
- root `libs/` as shared project code;
- app-local `libs/` shadowing root aliases;
- one managed project hosting multiple runnable app units.

## What this example intentionally does not cover

- tools;
- nested logging trees;
- refresh from non-default import locations;
- compact and cleanup workflows.
