# Config Sync

Alteran keeps several generated or semi-generated config surfaces coherent.

## Main Files

- `alteran.json`
- root `deno.json`
- app `deno.json`
- generated activation files

## Refresh Responsibilities

`refresh` currently:

- ensures default Alteran config exists
- discovers apps and tools from project structure
- preserves and normalizes registry metadata
- syncs root Deno tasks and imports
- syncs workspace entries for apps
- ensures per-app config and app tasks/imports

## Root `deno.json` Sync

Alteran owns and refreshes:

- `tasks.alteran`
- `tasks.refresh`
- `tasks.test`
- `tasks.app:<name>`
- `tasks.tool:<name>`
- `imports` for `@alteran`, `@logtape/logtape`, and `@libs/*`
- `workspace` entries for registered apps

User-defined unrelated tasks and imports are preserved where possible.

## Registry Discovery

Discovery is structure-driven:

- apps: direct subdirectories under `apps/`
- tools: `tools/*.ts` or `tools/<name>/mod.ts`

Existing entry metadata such as `shell_aliases` is preserved when possible.

If `shell_aliases` is explicitly present as `[]` or `null`, that explicit state should be respected rather than replaced by automatic reseeding.

## Path Resolution Rule

Config-driven paths resolve from the owning config context, not from arbitrary caller `PWD`.

If sync behavior changes based on where the caller happened to `cd`, treat that as a bug.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Command Model](./command-model.md)
- Next: [Generated Files](./generated-files.md)
