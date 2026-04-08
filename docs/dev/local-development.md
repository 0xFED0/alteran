# Local Development

Alteran is developed from its own repository using the same general project model it applies to managed projects.

## Bootstrap The Repository

```sh
./setup
source ./activate
```

That materializes the repository-local runtime and local managed Deno under `.runtime/`.

`activate` is sourced-only on Unix. Treat `setup` as the bootstrap/repair surface and `activate` as the local environment-entry surface.

## Local Host Prerequisites

On Unix-like hosts, full Alteran repository development and test flows assume:

- `curl`
- `unzip`
- `zip`
- `git`

`setup` itself needs either a working global `deno` or local `curl` + `unzip` so it can materialize a project-local Deno runtime. The additional `zip` requirement is specific to this repository's development and test harness, because local fixture archives are created on the host during repository and example tests. `git` is also part of the repository-level test baseline because some documentation tests create clean tracked-file copies of the repository rather than copying untracked local state.

## Common Commands

```sh
alteran help
alteran refresh
alteran test -A
alteran test -A tests/alteran_unit_test.ts
alteran test -A tests/alteran_e2e_test.ts
alteran tool run prepare_jsr
alteran tool run prepare_zip
alteran tool run publish_jsr
deno run -A ./examples/reset.ts
```

`deno task ...` remains available, but for high-leverage product flows prefer running through Alteran so managed execution, logging, and project context stay honest.

## Source Of Truth

- authored implementation: `src/alteran/`, `src/tools/`, `src/libs/`
- generated local runtime: `.runtime/`
- generated publication output: `dist/jsr/<version>/`, `dist/zips/<version>/`

Do not treat `.runtime/` as the only authoritative source.

## Repository-Specific Notes

- examples often carry a small `.env` that points `ALTERAN_SRC` back to the repository `src/` tree
- local development is expected to be inspectable and source-first
- activation is generated locally; the checked-in public bootstrap surfaces are `setup` and `setup.bat`
- if a local run crosses into another Alteran project, do it explicitly rather than by leaking repository context into it
- if examples accumulate generated drift, restore them through `deno run -A ./examples/reset.ts` instead of treating `examples/` as disposable scratch space

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Dev Docs Overview](./overview.md)
- Next: [Repository Layout](./repository-layout.md)
