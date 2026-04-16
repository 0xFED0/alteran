# Project Layout

A normal Alteran-managed project is organized around a few predictable top-level categories.

## Baseline Layout After Setup

```text
project/
  setup
  setup.bat
  activate
  activate.bat
  alteran.json
  deno.json
  deno.lock   # optional
  apps/
  tools/
  libs/
  tests/
  .runtime/
```

Optional project directories can include `docs/` and `examples/`.

## Top-Level Files

- `setup`, `setup.bat`: public bootstrap entrypoints that can regenerate the local environment
- `activate`, `activate.bat`: generated local activation entrypoints
- `alteran.json`: Alteran project config
- `deno.json`: Deno config and workspace synchronization target
- `deno.lock`: optional but recommended lockfile

## Top-Level Directories

- `apps/`: managed applications
- `tools/`: managed tools and project automation
- `libs/`: shared project libraries
- `tests/`: project tests
- `.runtime/`: project-local runtime, local Deno, and logs

## Runtime Layout

```text
.runtime/
  alteran/
    bin/
  tools/
  libs/
  logs/
  deno/
    <os>-<arch>/
      bin/
      cache/
```

Important meaning:

- `.runtime/alteran/` is the local Alteran runtime
- `.runtime/alteran/bin/` contains generated local Alteran CLI wrappers and shims
- `.runtime/tools/` and `.runtime/libs/` are runtime helper areas
- `.runtime/deno/` is platform-specific
- `.runtime/logs/` is the canonical per-project log root

## Git Expectations

Generated and recoverable local state should stay out of version control. Typical ignored items include:

- `.runtime/`
- generated `activate` and `activate.bat`
- generated app launchers such as `apps/*/app` and `apps/*/app.bat`
- reproducible build output such as `dist/`

Public bootstrap files such as root `setup` and `setup.bat` stay tracked. App-local `setup` / `setup.bat` can also stay tracked, while app launchers are the throwaway generated side of that contract.

## Related Docs

- [Concepts](./concepts.md)
- [Activation](./activation.md)
- [Reference project layout](../reference/project-layout.md)

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Concepts](./concepts.md)
- Next: [Activation](./activation.md)
