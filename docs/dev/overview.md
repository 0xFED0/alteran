# Dev Docs Overview

These docs are for changing Alteran itself: the repository, runtime, bootstrapping rules, generated files, and publication flow.

## Start Here

- [Local development](./local-development.md)
- [Repository layout](./repository-layout.md)
- [Architecture](./architecture.md)

## Then Use As Needed

- [Runtime materialization](./runtime-materialization.md)
- [Command model](./command-model.md)
- [Config sync](./config-sync.md)
- [Generated files](./generated-files.md)
- [Managed execution](./managed-execution.md)
- [Logging](./logging.md)
- [Testing](./testing.md)
- [Publication](./publication.md)
- [Design rules](./design-rules.md)
- [Best practices](./best-practices/README.md)
- [ADR index](./adr/index.md)

## Core Contributor Mental Model

- authored source lives under `src/`
- `.runtime/` is generated local state
- the repository mirrors a managed project where helpful, but is not identical
- the public bootstrap surface must stay separate from generated activation
- documentation should stay aligned with specs and ADRs, not only accidental current behavior
- committed repository examples are source-first teaching surfaces; if they drift locally, restore them through `examples/reset.ts`

If you are brand new to the codebase, the most useful starting sequence is:

1. [Local development](./local-development.md)
2. [Repository layout](./repository-layout.md)
3. [Architecture](./architecture.md)
4. [ADR index](./adr/index.md) for the non-obvious constraints

## Navigation
- Home: [Docs Index](../README.md)
- Next: [Local Development](./local-development.md)
