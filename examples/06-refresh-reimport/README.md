# 06 Refresh Reimport

## What this example shows

This example simulates project growth in two realistic ways:

- a staged app is moved into `apps/` and discovered by `alteran refresh`;
- an external tool stays in `incoming-tools/` and is registered through `alteran reimport`.

## Why it matters

Alteran is not only a one-time scaffold generator. It can resynchronize project state when new runnable units are introduced as the project evolves.

## Project shape / tree overview

```text
06-refresh-reimport/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  apps/
    catalog/
      app.json
      deno.json
      core/mod.ts
      view/README.md
  incoming-apps/
    admin-console/
      app.json
      deno.json
      core/mod.ts
      view/README.md
  incoming-tools/
    audit-report.ts
    audit-report/mod.ts
  libs/
    labels/mod.ts
```

## How to run it

```sh
./setup
source ./activate
cp -R ./incoming-apps/admin-console ./apps/admin-console
alteran refresh
alteran reimport tools ./incoming-tools
alteran app run admin-console
alteran tool run audit-report
```

## What to observe

- `catalog` is present from the start;
- the committed `.env` keeps setup local to the repository source tree;
- `admin-console` becomes part of the managed workspace after it moves into `apps/` and you run `refresh`;
- `audit-report` becomes registered after `reimport tools`;
- `alteran.json` and root `deno.json` update after synchronization commands;
- newly imported units become runnable through normal Alteran commands.

## Key Alteran concepts demonstrated

- refresh as project synchronization;
- refresh-driven discovery from the default `apps/` structure;
- explicit reimport from a non-default tools directory;
- evolving project structure without manual registry editing.

## What this example intentionally does not cover

- bootstrap from an empty folder;
- nested log trees;
- cleanup and compacting.
