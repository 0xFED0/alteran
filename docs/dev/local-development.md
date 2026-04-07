# Local Development

Alteran is developed from its own repository using the same general project
model it applies to managed projects.

## Bootstrap The Repository

```sh
./setup
source ./activate
```

That materializes the repository-local runtime and local managed Deno under
`.runtime/`.

## Common Commands

```sh
alteran help
deno task refresh
deno task test
deno task test:unit
deno task test:e2e
deno task tool:prepare_jsr
deno task tool:prepare_zip
```

## Source Of Truth

- authored implementation: `src/alteran/`, `src/tools/`, `src/libs/`
- generated local runtime: `.runtime/`
- generated publication output: `dist/jsr/<version>/`, `dist/zips/<version>/`

Do not treat `.runtime/` as the only authoritative source.

## Repository-Specific Notes

- examples often carry a small `.env` that points `ALTERAN_SRC` back to the
  repository `src/` tree
- local development is expected to be inspectable and source-first
- activation is generated locally; the checked-in public bootstrap surfaces are
  `setup` and `setup.bat`

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Dev Docs Overview](./overview.md)
- Next: [Repository Layout](./repository-layout.md)
