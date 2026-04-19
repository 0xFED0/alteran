# Repository Layout

The Alteran repository intentionally resembles a managed Alteran project while also keeping repository-only areas.

## High-Level Tree

```text
alteran/
  setup
  setup.bat
  activate
  activate.bat
  activate.ps1
  alteran.ts
  alteran.json
  deno.json
  deno.lock
  src/
    alteran/
    tools/
    libs/
  apps/
  tools/
  libs/
  tests/
  docs/
  examples/
  dist/
  .runtime/
```

## Important Distinctions

- `src/` is authored source-of-truth for Alteran itself
- `apps/`, `tools/`, `libs/`, and `tests/` mirror the managed-project model
- `docs/` contains user, dev, reference, ADR, and spec content
- `examples/` contains runnable product-facing scenarios
- `dist/` contains versioned publication artifacts
- `.runtime/` is generated local repository runtime state

## Root Entrypoints

- `alteran.ts`: stable public repository/package entrypoint
- `setup`, `setup.bat`: public bootstrap entrypoints
- `activate`, `activate.bat`, `activate.ps1`: generated repository-local activation entrypoints

## Why The Layout Mirrors Managed Projects

The repository is meant to dogfood the managed-project model without pretending that repository-specific authored source and publication concerns do not exist.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Local Development](./local-development.md)
- Next: [Architecture](./architecture.md)
