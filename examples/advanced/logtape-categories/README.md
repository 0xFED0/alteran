# Advanced LogTape Categories

## What this example shows

This example uses the bundled LogTape proxy together with
`@alteran/logging/logtape_ext` helpers and explicitly mirrors structured records
into Alteran's managed log stream.

## Why it matters

The basic logging example proves run capture. This advanced example shows how to
make those logs semantically richer for tooling and diagnostics.

## Project shape / tree overview

```text
advanced/logtape-categories/
  .env
  .gitignore
  setup
  setup.bat
  alteran.json
  deno.json
  tests/
    .keep
  libs/
    context_helpers/mod.ts
  tools/
    audit-log.ts
    audit-log/mod.ts
```

## How to run it

```sh
./setup
source ./activate
alteran tool run audit-log nightly-sync
```

## What to observe

- `.runtime/logs/.../events.jsonl` contains mirrored structured events with
  `source: "logtape"`;
- categories become more specific than the default run lifecycle events;
- the committed `.env` keeps setup local to the repository source tree;
- context such as `job` and `stage` is attached to emitted entries.

## Key Alteran concepts demonstrated

- LogTape-style structured logging;
- category and context composition;
- integration with Alteran-managed log capture.

## What this example intentionally does not cover

- basic bootstrap and activation;
- standalone app behavior.
