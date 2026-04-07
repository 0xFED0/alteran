# App Layout Reference

## Managed App Baseline

```text
apps/<name>/
  app.json
  deno.json
  core/
    mod.ts
  libs/
  view/
```

## `app.json` Key Fields

- `name`
- `id`
- `version`
- `title`
- `standalone`
- `view.enabled`
- `entry.core`
- `entry.view`
- `entry.app`

## Generated Local Helper Scripts

Managed apps may also receive:

- `setup`
- `setup.bat`
- `app`
- `app.bat`

Meaning:

- `setup` / `setup.bat` are app-local bootstrap entrypoints
- `app` / `app.bat` are generated launchers for running the app directly

Treat the launchers as generated local surfaces. The setup entrypoints are still Alteran-owned/generated, but they belong to the app's public bootstrap story rather than to the canonical source files under `core/`, `libs/`, and `view/`.

## Standalone App Difference

A standalone app uses the same basic structure, but `standalone` is `true` and the app owns its own local `.runtime/` expectations.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Project Layout Reference](./project-layout.md)
- Next: [Tool Layout Reference](./tool-layout.md)
