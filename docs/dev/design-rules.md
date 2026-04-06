# Design Rules

These rules should guide future Alteran changes.

## Core Rules

- keep Deno as the runtime
- keep bootstrap shell minimal and own real logic in TypeScript
- keep authored source in `src/`, not in `.runtime/`
- keep `setup` separate from generated `activate`
- keep managed execution explicit instead of mutating plain Deno semantics
- keep project context project-scoped, not shell-global
- keep archive sources responsible for installation/materialization
- keep `view` reserved rather than over-designing GUI architecture early

## Documentation Rule

Do not let high-level docs silently drift away from specs, ADRs, and actual
behavior. README is the front door, not the whole house.

## Repository Rule

The repository should mirror the managed project model where useful, but remain
honest about repository-only authored source and publication concerns.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Publication](./publication.md)
- Next: [ADR Index](./adr/index.md)
